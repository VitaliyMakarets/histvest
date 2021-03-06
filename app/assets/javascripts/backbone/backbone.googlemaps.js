/*!
 * Backbone.GoogleMaps
 * A Backbone JS layer for the GoogleMaps API
 * Copyright (c)2012 Edan Schwartz
 * Distributed under MIT license
 * https://github.com/eschwartz/backbone.googlemaps
 */
(function(root, factory) {
  if(typeof define === 'function' && define.amd) {
      // AMD. Register as an anonymous module.
      define(['backbone', 'underscore', 'jquery'], factory);
  }
  else {
    // Browser globals
    factory(root.Backbone, root._, root.jQuery || root.Zepto || root.ender);
  }
}(this, function(Backbone, _, $) {

  'use strict';
  
  var GoogleMaps = {};

  /**
   * GoogleMaps.Location
   * --------------------
   * Representing a lat/lng location on a map
   */
  GoogleMaps.Location = Backbone.Model.extend({
    constructor: function() {
      _.bindAll(this, 'select', 'deselect', 'toggleSelect', 'getLatLng', 'getLatlng');

      this.defaults = _.extend({}, {
        lat				: 0,
        lng				: 0,
        selected	: false,
        title			: ""
      }, this.defaults);

      Backbone.Model.prototype.constructor.apply(this, arguments);

      // Trigger 'selected' and 'deselected' events
      this.on("change:selected", function(model, isSelected) {
        var topic = isSelected ? "selected" : "deselected";
        this.trigger(topic, this);        
      }, this);
    },

    select: function() {
      this.set("selected", true);
    },

    deselect: function() {
      this.set("selected", false);
    },

    toggleSelect: function() {
      this.set("selected", !this.get("selected"));      
    },

    getLatlng: function() {
      return this.getLatLng();
    },

    getLatLng: function() {
      return new google.maps.LatLng(this.get("lat"), this.get("lng"));
    }
  });

  /**
   * GoogleMaps.LocationCollection
   * ------------------------------
   * A collection of map locations
   */
  GoogleMaps.LocationCollection = Backbone.Collection.extend({
    model: GoogleMaps.Location,

    constructor: function() {
      Backbone.Collection.prototype.constructor.apply(this, arguments);

      
    }
  });


  /**
   * GoogleMaps.MapView
   * ------------------
   * Base maps overlay view from which all other overlay views extend
   */
  GoogleMaps.MapView = Backbone.View.extend({
    // Hash of Google Map events
    // Events will be attached to this.gOverlay (google map or overlay)
    // eg `zoom_changed': 'handleZoomChange'
    mapEvents: {},

    overlayOptions: {},

    constructor: function() {
      _.bindAll(this, 'render', 'close');

      Backbone.View.prototype.constructor.apply(this, arguments);

      // Ensure map and API loaded
      if(!google || !google.maps) throw new Error("Google maps API is not loaded.");
      if(!this.options.map && !this.map) throw new Error("A map must be specified.");
      this.gOverlay = this.map = this.options.map || this.map;

      // Set this.overlay options
      this.overlayOptions || (this.overlayOptions = this.options.overlayOptions);
    },

    // Attach listeners to the this.gOverlay
    // From the `mapEvents` hash
    bindMapEvents: function(mapEvents) {
      mapEvents || (mapEvents = this.mapEvents);

      for(var event in mapEvents) {
        var handler = mapEvents[event];
        google.maps.event.addListener(this.gOverlay, event, this[handler]);
      }
    },

    render: function() {
      this.trigger('before:render');
      if(this.beforeRender) { this.beforeRender(); }
      this.bindMapEvents();

      this.trigger('render');
      if(this.onRender) { this.onRender(); }

      return this;
    },

    // Clean up view
    // Remove overlay from map and remove event listeners
    close: function() {
      this.trigger('before:close');
      if(this.beforeClose) { this.beforeClose(); }

      google.maps.event.clearInstanceListeners(this.gOverlay);
      if(this.gOverlay.setMap) { this.gOverlay.setMap(null); }
      this.gOverlay = null;

      this.trigger('close');
      if(this.onClose) { this.onClose(); }
    }
  });

  /**
   * GoogleMaps.InfoWindow
   * ---------------------
   * View controller for a google.maps.InfoWindow overlay instance
   */
  GoogleMaps.InfoWindow = GoogleMaps.MapView.extend({
    constructor: function() {
      GoogleMaps.MapView.prototype.constructor.apply(this, arguments);

      _.bindAll(this, 'render', 'close');

      // Require a related marker instance
      if(!this.options.marker && !this.marker) throw new Error("A marker must be specified for InfoWindow view.");
      this.marker = this.options.marker || this.marker;

      // Set InfoWindow template
      this.template = this.template || this.options.template;

    },

    // Render
    render: function() {
      this.trigger('before:render');
      if(this.beforeRender) { this.beforeRender(); }

      GoogleMaps.MapView.prototype.render.apply(this, arguments);

      // Render element
      var tmpl = (this.template)? $(this.template).html(): '<h2><%=title %></h2>';
      this.$el.html(_.template(tmpl, this.model.toJSON()));

      // Create InfoWindow
      this.gOverlay = new google.maps.InfoWindow(_.extend({
        content: this.$el[0]
      }, this.overlayOptions));

      // Display InfoWindow on map
      this.gOverlay.open(this.map, this.marker);

      this.trigger('render');
      if(this.onRender) { this.onRender(); }

      return this;
    },

    // Close and delete window, and clean up view
    close: function() {
      this.trigger('before:close');
      if(this.beforeClose) { this.beforeClose(); }

      GoogleMaps.MapView.prototype.close.apply(this, arguments);

      this.trigger('close');
      if(this.onClose) { this.onClose(); }

      return this;
    }
  });


  /**
   * GoogleMaps.MarkerView
   * ---------------------
   * View controller for a marker overlay
   */
  GoogleMaps.MarkerView = GoogleMaps.MapView.extend({
    // Set associated InfoWindow view
    infoWindow: GoogleMaps.InfoWindow,

    constructor: function() {
      GoogleMaps.MapView.prototype.constructor.apply(this, arguments);

      _.bindAll(this, 'render', 'close', 'openDetail', 'closeDetail', 'toggleSelect', 'updateModelPosition', 'updateModelAddress');

      // Ensure model
      if(!this.model) throw new Error("A model must be specified for a MarkerView");

      // Instantiate marker, with user defined properties
      this.gOverlay = new google.maps.Marker(_.extend({
        position: this.model.getLatLng(),
        map: this.map,
        title: $.trim(this.model.get('title'))==''? this.model.get('geo_address') : this.model.get('title'),        
        icon: this.model.getIcon(),
        visible: true,					// hide, until render
        draggable: this.model.isDraggable(),
        animation: this.model.isNew()? google.maps.Animation.DROP : null
      }, this.overlayOptions));

      this.model.set('gOverlay', this.gOverlay);

      // Add default mapEvents
      _.extend(this.mapEvents, {
        'click'	: 'toggleSelect'							// Select model on marker click
      });

      // Show detail view on model select      
      this.model.on("change:lat change:lng", this.refreshOverlay, this);

      this.model.on("change:selected", this.refreshOverlay, this);

      // Sync location model lat/lng with marker position
      this.bindMapEvents({
        'mouseup': 'updateModelPosition'
      });

      
      this.bindMapEvents({
        'mouseup': 'updateModelAddress'
      });
      
    },

    // update overlay position if lat or lng change
    refreshOverlay: function() {
      // Only update overlay if we're not already in sync
      // Otherwise we end up in an endless loop of      
      if(this.gOverlay.getIcon() != this.model.getIcon()) {
        this.gOverlay.setIcon(this.model.getIcon());
      }

      // set marker movable or not
      this.gOverlay.setDraggable( this.model.isDraggable() );

      // update model <--eventhandler--> update overlay
      if(!this.model.getLatLng().equals(this.gOverlay.getPosition())) {
        this.gOverlay.setOptions({
          position: this.model.getLatLng()
        });
      }
    },

    updateModelPosition: function() {
      var newPosition = this.gOverlay.getPosition();

      // Only update model if we're not already in sync
      // Otherwise we end up in an endless loop of
      // update model <--eventhandler--> update overlay
      if(!this.model.getLatLng().equals(newPosition)) {
        this.model.set({
          lat: newPosition.lat(),
          lng: newPosition.lng()
        });
      }
    },

    updateModelAddress: function() {
        var newPosition = this.gOverlay.getPosition();
        var _this = this;
        _this.model.set("title","");
        _this.gOverlay.setTitle("");
        window.geocoder.geocode({latLng: newPosition}, function(results, status) {
            if (status == google.maps.GeocoderStatus.OK && results.length > 0) {
               _this.model.set('geo_address', results[0].formatted_address);               
               _this.gOverlay.setTitle(results[0].formatted_address);
               $(document).tooltip( "destroy" );
               $(document).tooltip();
            }
         });
    },

    toggleSelect: function() {
      this.model.toggleSelect();
    },

    // Show the google maps marker overlay
    render: function() {
      this.trigger('before:render');
      if(this.beforeRender) { this.beforeRender(); }

      GoogleMaps.MapView.prototype.render.apply(this, arguments);
      this.gOverlay.setVisible(true);

      this.trigger('render');
      if(this.onRender) { this.onRender(); }

      return this;
    },

    close: function() {
      this.trigger('before:close');
      if(this.beforeClose) { this.beforeClose(); }

      this.closeDetail();
      GoogleMaps.MapView.prototype.close.apply(this, arguments);
      this.model.off();

      this.trigger('close');
      if(this.onClose) { this.onClose() }

      return this;
    },

    openDetail: function() {
      this.detailView = new this.infoWindow({
        model: this.model,
        map: this.map,
        marker: this.gOverlay
      });
      this.detailView.render();
    },

    closeDetail: function() {
      if(this.detailView) {
        this.detailView.close();
        this.detailView = null;
      }
    }
  });


  /**
   * GoogleMaps.MarkerCollectionView
   * -------------------------------
   * Collection of MarkerViews
   */
  GoogleMaps.MarkerCollectionView = Backbone.View.extend({
    markerView: GoogleMaps.MarkerView,

    markerViewChildren: {},

    constructor: function() {
      Backbone.View.prototype.constructor.apply(this, arguments);

      _.bindAll(this, 'render', 'closeChildren', 'closeChild', 'addChild', 'refresh', 'close');

      // Ensure map property
      if(!this.options.map && !this.map) throw new Error("A map must be specified on MarkerCollectionView instantiation");
      this.map || (this.map = this.options.map);

      // Bind to collection
      this.collection.on("reset", this.refresh, this);
      this.collection.on("add", this.addChild, this);
      this.collection.on("remove", this.closeChild, this);

    },

    // Render MarkerViews for all models in collection
    render: function(collection) {
      var collection = collection || this.collection;

      this.trigger('before:render');
      if(this.beforeRender) { this.beforeRender(); }

      // Create marker views for each model
      collection.each(this.addChild);

      this.trigger('render');
      if(this.onRender) { this.onRender(); }

      return this;
    },

    // Close all child MarkerViews
    closeChildren: function() {
      for(var cid in this.markerViewChildren) {
        this.closeChild(this.markerViewChildren[cid]);
      }
    },

    closeChild: function(child) {
      // Param can be child's model, or child view itself
      var childView = (child instanceof Backbone.Model)? this.markerViewChildren[child.cid]: child;

      childView.close();
      delete this.markerViewChildren[childView.model.cid];
    },

    // Add a MarkerView and render
    addChild: function(childModel) {
      if(this.markerViewChildren[childModel.cid]) return this;

      var markerView = new this.markerView({
        model: childModel,
        map: this.map
      });
      

      this.markerViewChildren[childModel.cid] = markerView;

      markerView.render();
    },

    refresh: function() {
      this.closeChildren();
      this.render();
    },

    // Close all child MarkerViews
    close: function() {
      this.closeChildren();
      this.collection.off();
    }
  });

  Backbone.GoogleMaps = GoogleMaps;
  return GoogleMaps;
}));

