# RouteStreetViewer

## About
RouteStreetViewer tries to combine capabilities of two well-known tools - [BRouter](http://brouter.de/brouter-web/) and [Google Street View](https://www.google.com/streetview/). It should be quite useful especially for cyclist who would like to "view" created route before they start enjoing the ride.

## How it works?
First you need to create a route using BRouter and export it to GeoJSON. Then RouteStreetViewer generates GPX file with Street View waypoints based on provided GeoJSON file. Afterwards you are ready to view your track in web browser (see Demo below).

[GeoJSON](https://en.wikipedia.org/wiki/GeoJSON) contains features which can be refered as featured waypoints.

## Demo
[Sample route](https://rawgit.com/thof/RouteStreetViewer/master/routestreetviewer.html?filename=brouter_mazury_7.xml) generated using this tool:

[![Demo screenshot](https://i.imgur.com/OAVvkZI.png)](https://rawgit.com/thof/RouteStreetViewer/master/routestreetviewer.html?filename=brouter_mazury_7.xml)

## UI navigation
You can use mouse as usual with Google Maps or **Page Up** (next) and **Page Down** (previous) keys for switching between info windows. Using keys is probably the most convenient way of browsing entire track.

## Markers' colors
Markers can be in four colors with the following meaning:

|                 | Street view image available | Featured waypoint |
| --------------- |:---------------------------:|:-----------------:|
| **Red**         |                             | X                 |
| **Bright red**  |                             |                   |
| **Green**       | X                           | X                 |
| **Bright green**| X                           |                   |

## Usage
### Dependencies
* Python3
* libxml2 - XML parsing library, version 2
* python-lxml - Python3 binding for the libxml2 and libxslt libraries

For example on Manjaro it's enough to run pacman like this: `pacman -S python libxml2 python-lxml`

### Street View API key
What's more you need to get access to Steet View API. To do so see [Get API Key and Signature](https://developers.google.com/maps/documentation/streetview/get-api-key).
You can use it for free in standard plan but there are some [usage limits](https://developers.google.com/maps/documentation/streetview/usage-limits) like free number of map loads or maximum image resolution.

### First run
RouteStreetViewer.py expects two arguments:
* GeoJSON input file name exported from BRouter (mandatory)
* Configuration file name (optional, default: config.json)

1. Start Python HTTP server: `python3 -m http.server` 
1. Run RouteStreetViewer: `python RouteStreetViewer.py brouter_mazury.geojson config.json`
1. When it's done you will get the URL. Run it with Chromium or Firefox.

## Configuration file
Available parameters (all are mandatory):
* **api_key** - mentioned earlier Street View API key
* **file_counter** - incremented after each run (default: 0)
* **size** - Street View image size. Currently maximum resolution in free plan is 640x480 (default: 640x480)
* **fov** - determines the horizontal field of view of the image. More info in the Street View [documentation](https://developers.google.com/maps/documentation/streetview/intro) (default: 110)
* **pitch** -  specifies the up or down angle of the camera relative to the Street View vehicle. More info in the Street View [documentation](https://developers.google.com/maps/documentation/streetview/intro) (default: -20)
* **min_distance** - minimum distance between featured waypoints from GeoJSON. If the distance between two waypoints is smaller than specified (in meters) by this parameter then such waypoint is discarded (default: 150)
* **marker_gap** - if it's set to 2000 meters then there are three additional intermediate waypoints generated on 7000 meters long section (default: 2000) 
* **min_marker_gap** - if the distance between two waypoints is smaller that **marker_gap** value but larger than this parameter then nevertheless the script checks if there is a Street View image available in the center point between two featured waypoints (default: 800)


