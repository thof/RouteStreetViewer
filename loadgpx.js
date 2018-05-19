///////////////////////////////////////////////////////////////////////////////
// loadgpx.4.js
//
// Javascript object to load GPX-format GPS data into Google Maps.
//
// Copyright (C) 2006 Kaz Okuda (http://notions.okuda.ca)
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
//
// If you use this script or have any questions please leave a comment
// at http://notions.okuda.ca/geotagging/projects-im-working-on/gpx-viewer/
// A link to the GPL license can also be found there.
//
///////////////////////////////////////////////////////////////////////////////
//
// History:
//    revision 1 - Initial implementation
//    revision 2 - Removed LoadGPXFileIntoGoogleMap and made it the callers
//                 responsibility.  Added more options (colour, width, delta).
//    revision 3 - Waypoint parsing now compatible with Firefox.
//    revision 4 - Upgraded to Google Maps API version 2.  Tried changing the way
//               that the map calculated the way the center and zoom level, but
//               GMAP API 2 requires that you center and zoom the map first.
//               I have left the bounding box calculations commented out in case
//               they might come in handy in the future.
//
//    5/28/2010 - Upgraded to Google Maps API v3 and refactored the file a bit.
//                          (Chris Peplin)
//
// Author: Kaz Okuda
// URI: http://notions.okuda.ca/geotagging/projects-im-working-on/gpx-viewer/
//
// Updated for Google Maps API v3 by Chris Peplin
// Fork moved to GitHub: https://github.com/peplin/gpxviewer
//
///////////////////////////////////////////////////////////////////////////////

function GPXParser(xmlDoc, map, preloaded) {
    this.xmlDoc = xmlDoc;
    this.map = map;
    this.trackcolour = "#ff00ff"; // red
    this.trackwidth = 5;
    this.mintrackpointdelta = 0.0001;
    this.markers = [];
    this.markerIndex = -1;
    this.preloaded = preloaded;
}

// Set the colour of the track line segements.
GPXParser.prototype.setTrackColour = function(colour) {
    this.trackcolour = colour;
}

// Set the width of the track line segements
GPXParser.prototype.setTrackWidth = function(width) {
    this.trackwidth = width;
}

// Set the minimum distance between trackpoints.
// Used to cull unneeded trackpoints from map.
GPXParser.prototype.setMinTrackPointDelta = function(delta) {
    this.mintrackpointdelta = delta;
}

GPXParser.prototype.translateName = function(name) {
    if(name == "wpt") {
        return "Waypoint";
    }
    else if(name == "trkpt") {
        return "Track Point";
    }
    else if(name == "rtept") {
        return "Route Point";
    }
}

GPXParser.prototype.renderText = function(map) {
    text_listener = google.maps.event.addListener(map, 'idle', function() {
        var bounds = map.getBounds();
        var ne = bounds.getNorthEast();
        var sw = bounds.getSouthWest();
        var pos_lng = Math.abs(ne.lng()-sw.lng())*0.1;
        var pos_lat = Math.abs(ne.lat()-sw.lat())*0.02;
        var mapLabel = new MapLabel({
          text: 'Use page down and page up keys to switch between info windows',
          position: new google.maps.LatLng(ne.lat()-pos_lat, sw.lng()+pos_lng),
          map: map,
          fontSize: 20,
          fontColor: '#cc0000',
          align: 'left'
        });
        google.maps.event.removeListener(text_listener);
    });
}

GPXParser.prototype.addEventListener = function(evt, element, fn) {
    if (window.addEventListener) {
        element.addEventListener(evt, fn.bind(this), false);
    }
    else {
        element.attachEvent('on'+evt, fn.bind(this));
    }
}

GPXParser.prototype.handleKeyboardEvent = function(evt) {
  if (!evt) {evt = window.event;} // for old IE compatible
  var keycode = evt.keyCode || evt.which; // also for cross-browser compatible

  var info = document.getElementById("info");
  switch (keycode) {
    // page up = switch to the next marker
    case 33:
      google.maps.event.trigger(this.markers[this.markerIndex], "close");
      this.markerIndex = this.markerIndex + 1;
      if(this.markerIndex > this.markers.length - 1) {
        this.markerIndex = 0;
      }
      google.maps.event.trigger(this.markers[this.markerIndex], "open");
      break;
    // page down = switch to the previous marker
    case 34:
      google.maps.event.trigger(this.markers[this.markerIndex], "close");
      this.markerIndex = this.markerIndex - 1;
      if(this.markerIndex < 0) {
        this.markerIndex = this.markers.length - 1;
      }
      google.maps.event.trigger(this.markers[this.markerIndex], "open");
      break;
    default:
      // nothing
  }
}

GPXParser.prototype.createMarker = function(point) {
    var lon = parseFloat(point.getAttribute("lon"));
    var lat = parseFloat(point.getAttribute("lat"));
    var html = "";

    var pointElements = point.getElementsByTagName("html");
    if(pointElements.length > 0) {
        for(i = 0; i < pointElements.item(0).childNodes.length; i++) {
            html += pointElements.item(0).childNodes[i].nodeValue;
        }
    }
    else {
        // Create the html if it does not exist in the point.
        html = "<b>" + this.translateName(point.nodeName) + "</b><br>";
        var attributes = point.attributes;
        var attrlen = attributes.length;
        for(i = 0; i < attrlen; i++) {
            html += attributes.item(i).name + " = " +
                    attributes.item(i).nodeValue + "<br>";
        }

        if(point.hasChildNodes) {
            var children = point.childNodes;
            var childrenlen = children.length;
            for(i = 0; i < childrenlen; i++) {
                // Ignore empty nodes
                if(children[i].nodeType != 1) continue;
                if(children[i].firstChild == null) continue;
                html += children[i].nodeName + " = " +
                        children[i].firstChild.nodeValue + "<br>";
            }
        }
    }

    var imageExist = point.getElementsByTagName("exist");
    var feature = point.getElementsByTagName("feature");
    if (imageExist.length > 0 && feature.length > 0) {
        pin = this.pinSymbol('#009933') // green
    }
    else if (imageExist.length > 0) {
        pin = this.pinSymbol('#66ff66') // light green
    }
    else if (feature.length > 0) {
        pin = this.pinSymbol('#ff0000') // red
    } else
    {
        pin = this.pinSymbol('#ff6666') // light red
    }

    var marker = new google.maps.Marker({
        position: new google.maps.LatLng(lat,lon),
        map: this.map,
        icon: pin
    });

    if (this.preloaded == '' && imageExist.length > 0) {
        index = html.indexOf('|');
        html = "<img "+html.substring(0, index)+"><br>"+html.substring(index+1);
    }
    else if (imageExist.length > 0){
        html = "<div style=\"height:500px; width:640px; overflow: hidden;\">"+html+"</div>";
    }
    var infowindow = new google.maps.InfoWindow({
        content: html
    });

    var parent = this
    google.maps.event.addListener(marker, "click", function() {
        google.maps.event.trigger(parent.markers[parent.markerIndex], "close");
        infowindow.open(this.map, marker);
        contentString = infowindow.getContent();
        if(contentString.length > 58 && contentString.substring(58, 62).localeCompare("src=") == 0){
            $.ajax({
                success:function () {
                    index = contentString.indexOf('|')
                    contentString = contentString.substring(0, 58)+"<img "+contentString.substring(58, index)+"><br>"+contentString.substring(index+1, contentString.length-6)+"</div>";
                    infowindow.setContent(contentString);
                }
            });
        }
        parent.markerIndex = parent.markers.indexOf(marker)
    });

    google.maps.event.addListener(marker, "open", function() {
        infowindow.open(this.map, marker);
        contentString = infowindow.getContent();
        if(contentString.length > 58 && contentString.substring(58, 62).localeCompare("src=") == 0){
            $.ajax({
                success:function () {
                    index = contentString.indexOf('|')
                    contentString = contentString.substring(0, 58)+"<img "+contentString.substring(58, index)+"><br>"+contentString.substring(index+1, contentString.length-6)+"</div>";
                    infowindow.setContent(contentString);
                }
            });
        }
    });

    google.maps.event.addListener(marker, "close", function() {
        infowindow.close(this.map, marker);
    });

    return marker;
}

GPXParser.prototype.addTrackSegmentToMap = function(trackSegment, colour,
        width) {
    var trackpoints = trackSegment.getElementsByTagName("trkpt");
    if(trackpoints.length == 0) {
        return;
    }

    var pointarray = [];

    // process first point
    var lastlon = parseFloat(trackpoints[0].getAttribute("lon"));
    var lastlat = parseFloat(trackpoints[0].getAttribute("lat"));
    var latlng = new google.maps.LatLng(lastlat,lastlon);
    pointarray.push(latlng);

    for(var i = 1; i < trackpoints.length; i++) {
        var lon = parseFloat(trackpoints[i].getAttribute("lon"));
        var lat = parseFloat(trackpoints[i].getAttribute("lat"));

        // Verify that this is far enough away from the last point to be used.
        var latdiff = lat - lastlat;
        var londiff = lon - lastlon;
        if(Math.sqrt(latdiff*latdiff + londiff*londiff)
                > this.mintrackpointdelta) {
            lastlon = lon;
            lastlat = lat;
            latlng = new google.maps.LatLng(lat,lon);
            pointarray.push(latlng);
        }

    }

    var polyline = new google.maps.Polyline({
        path: pointarray,
        strokeColor: colour,
        strokeWeight: width,
        map: this.map
    });
}

GPXParser.prototype.addTrackToMap = function(track, colour, width) {
    var segments = track.getElementsByTagName("trkseg");
    for(var i = 0; i < segments.length; i++) {
        var segmentlatlngbounds = this.addTrackSegmentToMap(segments[i], colour,
                width);
    }
}

GPXParser.prototype.addRouteToMap = function(route, colour, width) {
    var routepoints = route.getElementsByTagName("rtept");
    if(routepoints.length == 0) {
        return;
    }

    var pointarray = [];

    // process first point
    var lastlon = parseFloat(routepoints[0].getAttribute("lon"));
    var lastlat = parseFloat(routepoints[0].getAttribute("lat"));
    var latlng = new google.maps.LatLng(lastlat,lastlon);
    pointarray.push(latlng);

    for(var i = 1; i < routepoints.length; i++) {
        var lon = parseFloat(routepoints[i].getAttribute("lon"));
        var lat = parseFloat(routepoints[i].getAttribute("lat"));

        // Verify that this is far enough away from the last point to be used.
        var latdiff = lat - lastlat;
        var londiff = lon - lastlon;
        if(Math.sqrt(latdiff*latdiff + londiff*londiff)
                > this.mintrackpointdelta) {
            lastlon = lon;
            lastlat = lat;
            latlng = new google.maps.LatLng(lat,lon);
            pointarray.push(latlng);
        }

    }

    var polyline = new google.maps.Polyline({
        path: pointarray,
        strokeColor: colour,
        strokeWeight: width,
        map: this.map
    });
}

GPXParser.prototype.centerAndZoom = function(trackSegment) {

    var pointlist = new Array("trkpt", "rtept", "wpt");
    var minlat = 0;
    var maxlat = 0;
    var minlon = 0;
    var maxlon = 0;

    for(var pointtype = 0; pointtype < pointlist.length; pointtype++) {

        // Center the map and zoom on the given segment.
        var trackpoints = trackSegment.getElementsByTagName(
                pointlist[pointtype]);

        // If the min and max are uninitialized then initialize them.
        if((trackpoints.length > 0) && (minlat == maxlat) && (minlat == 0)) {
            minlat = parseFloat(trackpoints[0].getAttribute("lat"));
            maxlat = parseFloat(trackpoints[0].getAttribute("lat"));
            minlon = parseFloat(trackpoints[0].getAttribute("lon"));
            maxlon = parseFloat(trackpoints[0].getAttribute("lon"));
        }

        for(var i = 0; i < trackpoints.length; i++) {
            var lon = parseFloat(trackpoints[i].getAttribute("lon"));
            var lat = parseFloat(trackpoints[i].getAttribute("lat"));

            if(lon < minlon) minlon = lon;
            if(lon > maxlon) maxlon = lon;
            if(lat < minlat) minlat = lat;
            if(lat > maxlat) maxlat = lat;
        }
    }

    if((minlat == maxlat) && (minlat == 0)) {
        this.map.setCenter(new google.maps.LatLng(49.327667, -122.942333), 14);
        return;
    }

    // Center around the middle of the points
    var centerlon = (maxlon + minlon) / 2;
    var centerlat = (maxlat + minlat) / 2;

    var bounds = new google.maps.LatLngBounds(
            new google.maps.LatLng(minlat, minlon),
            new google.maps.LatLng(maxlat, maxlon));
    this.map.setCenter(new google.maps.LatLng(centerlat, centerlon));
    this.map.fitBounds(bounds);
}

GPXParser.prototype.centerAndZoomToLatLngBounds = function(latlngboundsarray) {
    var boundingbox = new google.maps.LatLngBounds();
    for(var i = 0; i < latlngboundsarray.length; i++) {
        if(!latlngboundsarray[i].isEmpty()) {
            boundingbox.extend(latlngboundsarray[i].getSouthWest());
            boundingbox.extend(latlngboundsarray[i].getNorthEast());
        }
    }

    var centerlat = (boundingbox.getNorthEast().lat() +
            boundingbox.getSouthWest().lat()) / 2;
    var centerlng = (boundingbox.getNorthEast().lng() +
            boundingbox.getSouthWest().lng()) / 2;
    this.map.setCenter(new google.maps.LatLng(centerlat, centerlng),
            this.map.getBoundsZoomLevel(boundingbox));
}

GPXParser.prototype.addTrackpointsToMap = function() {
    var tracks = this.xmlDoc.documentElement.getElementsByTagName("trk");
    for(var i = 0; i < tracks.length; i++) {
        this.addTrackToMap(tracks[i], this.trackcolour, this.trackwidth);
    }
}

GPXParser.prototype.addWaypointsToMap = function() {
    var waypoints = this.xmlDoc.documentElement.getElementsByTagName("wpt");
    for(var i = 0; i < waypoints.length; i++) {
        this.markers.push(this.createMarker(waypoints[i]));
    }
}

GPXParser.prototype.addRoutepointsToMap = function() {
    var routes = this.xmlDoc.documentElement.getElementsByTagName("rte");
    for(var i = 0; i < routes.length; i++) {
        this.addRouteToMap(routes[i], this.trackcolour, this.trackwidth);
    }
}

GPXParser.prototype.pinSymbol = function(color) {
//    return {
//        path: google.maps.SymbolPath.CIRCLE,
//        scale: 6,
//        strokeWeight: 1,
//        fillColor: color,
//        fillOpacity: 1
//    };
    return {
        path: 'M 0,0 C -2,-20 -10,-22 -10,-30 A 10,10 0 1,1 10,-30 C 10,-22 2,-20 0,0 z',
        fillColor: color,
        fillOpacity: 1,
        strokeColor: '#000',
        strokeWeight: 1,
        scale: 0.8
    };
}