from Utils import Utils
from lxml import etree
import urllib.request
import os
import json
import math
import sys


class RouteStreetViewer:
    def __init__(self):
        # get config file name from argument
        if len(sys.argv) > 2:
            self.config_filename = sys.argv[2]
        else:
            self.config_filename = 'config.json'
        # read config
        self.config = Utils.read_json_file(self.config_filename)
        # get GeoJSON input filename
        if not sys.argv[1]:
            print('You need to pass input file as the first argument!')
            exit(1)
        self.input_filename = sys.argv[1]
        filename = os.path.basename(self.input_filename)
        # read config parameters
        self.subfolder = 'routes/'
        self.file_counter = self.config['file_counter']
        self.output_filename = filename[0:filename.rfind('.')] + '_' + str(self.file_counter) + '.xml'
        self.api_key = self.config['api_key']
        if not self.api_key:
            print('You need to add Google Steet View API key to config.json!')
            exit(1)
        self.size = self.config['size']
        self.fov = self.config['fov']
        self.pitch = self.config['pitch']
        self.min_distance = self.config['min_distance']
        self.marker_gap = self.config['marker_gap']
        self.min_marker_gap = self.config['min_marker_gap']
        self.image_cntr = 0
        # create subfolder for Street View images
        os.makedirs(self.subfolder + 'images_' + str(self.file_counter), exist_ok=True)

    def parse_geo_json(self):
        # read GeoJSON content
        geo_json = Utils.read_json_file(self.input_filename)
        # get  featured waypoints array
        features = geo_json['features'][0]['properties']['messages']
        features_len = len(features)
        # get coordinates array for all available points
        coordinates_array = geo_json['features'][0]['geometry']['coordinates']

        index_prev = 0
        street_view_array = []
        print('Processing {} featured waypoints...'.format(features_len))
        for index_feature, feature in enumerate(features):
            print('Featured waypoint {}/{}'.format(index_feature + 1, features_len))
            # beginning of the route
            if index_feature == 0:
                notes = 'Distance={}m; CostPerKm={}; Tags: {} {}'.format(features[index_feature + 1][3],
                                                                         features[index_feature + 1][4],
                                                                         features[index_feature + 1][9],
                                                                         features[index_feature + 1][10])
                image_exist = self.validate_coordinates(coordinates_array[0][0],
                                                        coordinates_array[0][1])
                angle = self.calc_heading_angle(coordinates_array[0][0], coordinates_array[0][1], coordinates_array)
                street_view_prev = self.create_street_view_elem(coordinates_array[0][0], coordinates_array[0][1],
                                                                coordinates_array[0][2], angle, image_exist, notes,
                                                                True)
                street_view_array.append(street_view_prev)
                index_prev = 0
                continue

            # ignore if given distance is lower than min_distance
            if int(feature[3]) < self.min_distance:
                continue
            # read basic values
            longitude = float(feature[0][:-6] + '.' + feature[0][-6:])
            latitude = float(feature[1][:-6] + '.' + feature[1][-6:])
            elevation = float(feature[2])
            distance = int(feature[3])
            # take notes from one feature ahead then the result is more intuitive
            notes = ''
            index_next_feature = index_feature + 1
            while index_next_feature < features_len:
                if int(features[index_next_feature][3]) < self.min_distance:
                    index_next_feature = index_next_feature + 1
                else:
                    notes = 'Distance={}m; CostPerKm={}; Tags: {} {}'.format(features[index_next_feature][3],
                                                                             features[index_next_feature][4],
                                                                             features[index_next_feature][9],
                                                                             features[index_next_feature][10])
                    break
            # calculate number of intermediate waypoints
            no_streetview_img = False
            gap = 0
            index = self.find_elem(longitude, latitude, coordinates_array)
            no_of_markers = int(distance / self.marker_gap)
            if no_of_markers > 0:  # several waypoints
                gap = int((index - index_prev) / (no_of_markers + 1))
            elif distance > self.min_marker_gap:  # only center waypoint
                # calculate gap to obtain only center waypoint
                no_streetview_img = True
                no_of_markers = 1
                gap = int((index - index_prev) / (no_of_markers + 1))
            # processing intermadiate waypoints
            while no_of_markers > 0:
                no_of_markers = no_of_markers - 1
                index_prev = index_prev + gap
                image_exist = self.validate_coordinates(coordinates_array[index_prev][0],
                                                        coordinates_array[index_prev][1])
                # if no_streetview_img is set then only add waypoints without Street View image available
                if image_exist and no_streetview_img:
                    continue
                angle = self.calc_heading_angle(coordinates_array[index_prev][0], coordinates_array[index_prev][1],
                                                coordinates_array)
                street_view_add = self.create_street_view_elem(coordinates_array[index_prev][0],
                                                               coordinates_array[index_prev][1],
                                                               coordinates_array[index_prev][2], angle, image_exist, '')
                street_view_array.append(street_view_add)
                if not image_exist:  # to minimize number of insignificant markers
                    break
            index_prev = index

            # processing featured waypoint
            image_exist = self.validate_coordinates(longitude, latitude)
            angle = self.calc_heading_angle(longitude, latitude, coordinates_array)
            street_view = self.create_street_view_elem(longitude, latitude, elevation, angle, image_exist, notes, True)
            street_view_array.append(street_view)

        # downloading Steet View images
        array_length = len(street_view_array)
        print('Number of generated Street View waypoints: {}'.format(array_length))
        print('\nReading images from street view: ')
        for index, street_view in enumerate(street_view_array):
            print('{} {}/{}'.format(street_view[3], index + 1, array_length))
            # download only if image is available
            if street_view[5]:
                self.download_image(street_view)

        # generate GPX file
        self.generate_gpx(street_view_array, coordinates_array)
        # update file counter and save the configuration file
        self.config['file_counter'] = self.file_counter + 1
        Utils.save_json_file(self.config_filename, self.config)

    def calc_heading_angle(self, longitude, latitude, coordinates_array):
        # designate heading by calculating angle between two vectors
        vec_a = []
        vec_b = []
        index = self.find_elem(longitude, latitude, coordinates_array)
        while True:
            vec_a = []
            vec_b = []
            longitude_next = coordinates_array[index + 1][0]
            latitude_next = coordinates_array[index + 1][1]
            vec_a.append(longitude_next * 1000000 - longitude * 1000000)
            vec_a.append(latitude_next * 1000000 - latitude * 1000000)
            vec_b.append(0)
            vec_b.append(abs(vec_a[1]))
            dot_product = vec_a[1] * vec_b[1]
            len_a = math.sqrt(vec_a[0] * vec_a[0] + vec_a[1] * vec_a[1])
            len_b = math.sqrt(vec_b[1] * vec_b[1])
            if len_a == 0.0 or len_b == 0.0:
                index = index + 1
                continue
            cos = dot_product / (len_a * len_b)
            angle = math.acos(cos) * 180 / 3.14
            if vec_a[0] < 0:
                angle = 360 - angle
            return int(angle)

    def create_street_view_elem(self, longitude, latitude, elevation, angle, image_exist, notes, feature=False):
        street_view = [longitude, latitude, elevation]
        image_name = 'image_' + str(self.image_cntr) + '.jpg'
        self.image_cntr = self.image_cntr + 1
        street_view.append(image_name)
        street_view.append(angle)
        street_view.append(image_exist)
        street_view.append(notes)
        street_view.append(feature)
        return street_view

    def validate_coordinates(self, longitude, latitude):
        # check if Street View image is available for given geo coordinates
        url = 'https://maps.googleapis.com/maps/api/streetview/metadata?location={},{}&key={}'.format(latitude,
                                                                                                      longitude,
                                                                                                      self.api_key)
        response = urllib.request.urlopen(url)
        resp_json = json.loads(response.read())
        if resp_json['status'] == 'OK':
            return True
        else:
            return False

    @staticmethod
    def find_elem(longitude, latitude, array):
        for index, sublist in enumerate(array):
            if sublist[0] == longitude and sublist[1] == latitude:
                return index
        # in case of last featured element return penultimate index from coordinates array
        return len(array) - 2

    def download_image(self, street_view_elem):
        # download Street View image for given waypoint
        url = 'https://maps.googleapis.com/maps/api/streetview?size={}&location={},{}&fov={}&pitch={}&heading={}' \
              '&key={}'.format(self.size, street_view_elem[1], street_view_elem[0], self.fov, self.pitch,
                               street_view_elem[4], self.api_key)
        # print(url)
        response = urllib.request.urlopen(url)
        with open(self.subfolder + 'images_' + str(self.file_counter) + '/' + street_view_elem[3], 'wb') as f:
            f.write(response.read())

    def generate_gpx(self, street_view_array, coordinates_array):
        attr_qname = etree.QName('http://www.w3.org/2001/XMLSchema-instance', 'schemaLocation')
        gpx = etree.Element('gpx',
                            {attr_qname: 'http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd'},
                            nsmap={None: 'http://www.topografix.com/GPX/1/1',
                                   'xsi': 'http://www.w3.org/2001/XMLSchema-instance'},
                            creator='https://github.com/thof/RouteStreetViewer', version='1.1')
        for street_view in street_view_array:
            wpt = etree.SubElement(gpx, 'wpt', lat=str(street_view[1]), lon=str(street_view[0]))
            ele = etree.SubElement(wpt, 'ele')
            ele.text = str(street_view[2])
            name = etree.SubElement(wpt, 'name')
            name.text = street_view[3]
            extensions = etree.SubElement(wpt, 'extensions')
            html = etree.SubElement(extensions, 'html')
            # if image exist
            if street_view[5]:
                html.text = etree.CDATA(
                    'src="{}/{}"|{}'.format(self.subfolder + 'images_' + str(self.file_counter), street_view[3],
                                            street_view[6]))
                etree.SubElement(extensions, 'exist')
            else:
                # put note
                html.text = 'Missing Google Street View image<br>{}'.format(street_view[6])
            # if feature waypoint
            if street_view[7]:
                etree.SubElement(extensions, 'feature')

        trk = etree.SubElement(gpx, 'trk')
        name = etree.SubElement(trk, 'name')
        name.text = self.output_filename
        trkseg = etree.SubElement(trk, 'trkseg')
        for coord in coordinates_array:
            trkpt = etree.SubElement(trkseg, 'trkpt', lon=str(coord[0]), lat=str(coord[1]))
            ele = etree.SubElement(trkpt, 'ele')
            ele.text = str(coord[2])

        # print(etree.tostring(gpx, pretty_print=True, xml_declaration=True))
        et = etree.ElementTree(gpx)
        with open(self.subfolder + self.output_filename, 'wb') as f:
            et.write(f, pretty_print=True, encoding='utf-8', xml_declaration=True)

        print('\nRoute URL: http://0.0.0.0:8000/routestreetviewer.html?filename={}'.format(self.output_filename))
        print('\nPreloaded: http://0.0.0.0:8000/routestreetviewer.html?filename={}&preloaded'.format(
            self.output_filename))


if __name__ == "__main__":
    rsv = RouteStreetViewer()
    rsv.parse_geo_json()
