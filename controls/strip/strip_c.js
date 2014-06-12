/*
 * Breach: [mod_layout] strip_c.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-06-11 spolu  Removed angularJS
 * - 2014-06-04 spolu  Forked from `mod_stack`
 * - 2014-05-21 spolu  New state format (tabs on core_state)
 * - 2013-08-15 spolu  Creation
 */
'use strict'

// ### strip_c
//
// ```
// @spec { strip_el }
// ```
var strip_c = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {};

  my.strip_el = spec.strip_el || $('.strip');
  my.wrapper_el = my.strip_el.find('.wrapper');
  my.tabs_el = my.strip_el.find('.tabs');

  my.TAB_WIDTH = 170;
  my.TAB_MARGIN = 0;

  /* Dictionary of tabs div elements. */
  my.tabs_divs = {};
  my.active = null;

  //
  // ### _public_
  //
  var select_tab;         /* select_tab(tab_id); */
  var close_tab;          /* close_tab(tab_id); */

  var cmd_back;           /* cmd_back(); */
  var cmd_forward;        /* cmd_forward(); */
  var cmd_new;            /* cmd_new(); */

  var init;               /* init(); */
  
  //
  // ### _private_
  //
  var create_tab;         /* create_tab(tab_id); */
  var update_tab;         /* update_tab(tab_id, data); */
  var position_tab;       /* update_tab(tab_id, idx); */
  var remove_tab;         /* update_tab(tab_id); */

  var mousewheel_handler; /* mousewheel_handler(evt); */
  var state_handler;      /* state_handler(state); */

  var that = {};

  /****************************************************************************/
  /* PRIVATE HELPERS */
  /****************************************************************************/
  // ### create_tab
  //
  // Creates a new tab div element with the specified id
  // ```
  // @tab_id {string} the id of the tab
  // ```
  create_tab = function(tab_id) {
    var tab = $('<div/>')
      .attr('id', tab_id)
      .addClass('tab')
      .click(function() {
        select_tab(tab_id);
      })
      .append($('<div/>')
        .addClass('separator'))
      .append($('<div/>')
        .addClass('loading'))
      .append($('<div/>')
        .addClass('favicon'))
      .append($('<div/>')
        .addClass('content')
        .append($('<div/>')
          .addClass('shadow'))
        .append($('<div/>')
          .addClass('title')))
      .append($('<div/>')
        .addClass('close')
        .click(function() {
          close_tab(tab_id);
        })
        .append($('<div/>')
          .addClass('icon-iconfont-01')));
    return tab;
  };

  // ### update_tab
  //
  // Updates the tab with the specified id with the newly received state
  // ```
  // @tab_id {string} the tab id
  // @data   {object} tab data and state received
  // ```
  update_tab = function(tab_id, data) {
    var tab = my.tabs_divs[tab_id];
    tab.removeClass('active');

    /* Construct desc object. */
    var desc = {
      title: '',
      url: { hostname: '', href: '' },
      favicon: '',
      loading: false
    };
    if(data.type === 'new_tab') {
      desc.title = 'New Tab';
      desc.url = 'blank';
    }
    else {
      desc.title = data.title;
      desc.url = data.url || '';
      if(data.state) {
        /* TODO(spolu): Keep old title as long as possible? */
        if(data.state.loading && !desc.title) {
          desc.title = 'Loading...';
        }
        data.state.entries.forEach(function(n) {
          if(n.visible) {
            if(n.favicon) {
              desc.favicon = n.favicon;
            }
          }
        });
        desc.loading = data.state.loading;
      }
    }

    /* Update title. */
    tab.find('.title').text(desc.title);
    /* Update active state. */
    if(my.active === tab_id)
      tab.addClass('active');
    /* Update favicon. */
    if(desc.favicon && desc.favicon.length > 0) {
      var favicon_sha = SHA1(desc.favicon);
      var favicon_el = tab.find('.favicon');
      var content_el = tab.find('.content');
      if(favicon_sha !== favicon_el.attr('favicon_sha')) {
        favicon_el.css('display', 'block');
        content_el.addClass('with-favicon');
        favicon_el.css('background-image', 
                        'url(' + desc.favicon + ')');
        favicon_el.attr('favicon_sha', favicon_sha);
        favicon_el.attr('favicon_host', desc.url.hostname);
      }
    }
    else {
      var favicon_sha = SHA1('');
      var favicon_el = tab.find('.favicon');
      var content_el = tab.find('.content');
      if(favicon_el.attr('favicon_host') !== desc.url.hostname &&
         favicon_sha !== favicon_el.attr('favicon_sha')) {
        favicon_el.css('display', 'none');
        content_el.removeClass('with-favicon');
        favicon_el.css('background-image', 
                        'none');
        favicon_el.attr('favicon_sha', favicon_sha);
        favicon_el.attr('favicon_host', desc.url.hostname);
      }
    }
    /* Update loading. */
    if(desc.loading && !tab.attr('loading')) {
      tab.find('.loading').css({
        'transition': 'none',
        'right': my.TAB_WIDTH + 'px'
      });
      var value = 10;
      var update = function() {
        tab.find('.loading').css({
          'transition': 'right 0.3s ease-out',
          'right': Math.floor(my.TAB_WIDTH - my.TAB_WIDTH * value / 100) + 'px'
        });
      }
      setTimeout(function() {
        if(tab.attr('loading')) {
          update();
        }
      }, 100);
      var itv = setInterval(function() {
        if(tab.attr('loading')) {
          value = Math.min(Math.floor(value + Math.random() * 10), 100);
          update();
        }
        else {
          clearInterval(itv);
        }
      }, 500);
      tab.attr('loading', 'true');
    }
    if(!desc.loading && tab.attr('loading')) {
      tab.find('.loading').css({
        'right': '0px'
      });
      tab.attr('loading', null);
    }
  };

  // ### position_tab
  //
  // Positions the tab given its index in the `state.tabs_order` array
  // ```
  // @tab_id {string} the tab id
  // @idx    {number} position
  // ```
  position_tab = function(tab_id, idx) {
    var tab = my.tabs_divs[tab_id];
    tab.css('left', idx * (my.TAB_WIDTH + my.TAB_MARGIN));
    /* If this is the active tab, we make sure it is visible. */
    if(my.active === tab_id) {
      var tabs_width = Object.keys(my.tabs_divs).length * (my.TAB_WIDTH + my.TAB_MARGIN);
      var tabs_left = my.tabs_el.position().left;

      if((idx + 1) * (my.TAB_WIDTH + my.TAB_MARGIN) + tabs_left > my.wrapper_el.width()) {
        my.tabs_el.css({ 
          'transition': 'left 0.2s',
          'left': (my.wrapper_el.width() - (idx + 1) * (my.TAB_WIDTH + my.TAB_MARGIN)) + 'px'
        });
      }
      else if(-tabs_left > idx * (my.TAB_WIDTH + my.TAB_MARGIN)) {
        my.tabs_el.css({ 
          'transition': 'left 0.2s',
          'left': (idx * (my.TAB_WIDTH + my.TAB_MARGIN)) + 'px'
        });
      }
    }
  };

  // ### remove_tab
  //
  // Removes a tab by id
  // ```
  // @tab_id {string} the tab id
  // ```
  remove_tab = function(tab_id) {
    var tab = my.tabs_divs[tab_id];
    delete my.tabs_divs[tab_id];
    tab.remove();
  };

  /**************************************************************************/
  /* JQUERY EVENTS HANDLER */
  /**************************************************************************/
  // ### mousewheel_handler
  //
  // Handles the mousewheel events to scroll tabs
  // ```
  // @evt {object} the jquery event
  // ```
  mousewheel_handler = function(evt) {
    var tabs_width = Object.keys(my.tabs_divs).length * (my.TAB_WIDTH + my.TAB_MARGIN);
    var tabs_left = my.tabs_el.position().left;

    var update = tabs_left + evt.originalEvent.wheelDeltaX;
    if(my.wrapper_el.width() - update > tabs_width) {
      update = my.wrapper_el.width() - tabs_width;
    }
    if(update > 0) {
      update = 0;
    }
    my.tabs_el.css({ 
      'transition': 'none',
      'left': (update) + 'px'
    });
  };

  /**************************************************************************/
  /* SOCKET.IO HANDLER */
  /**************************************************************************/
  // ### state_handler
  //
  // Socket.io `state` event handler
  // ```
  // @state {object} the tabs state
  // ```
  state_handler = function(state) {
    if(state) {
      var tabs_data = {};
      var tabs_order = [];
      /* Create any missing tab. */
      state.tabs.forEach(function(t) {
        tabs_data[t.tab_id] = t;
        tabs_order.push(t.tab_id);
        if(!my.tabs_divs[t.tab_id]) {
          my.tabs_divs[t.tab_id] = create_tab(t.tab_id);
          my.strip_el.find('.tabs').append(my.tabs_divs[t.tab_id]);
        }
      });
      /* Cleanup Closed tabs */
      Object.keys(my.tabs_divs).forEach(function(tab_id) {
        if(!tabs_data[tab_id]) {
          remove_tab(tab_id);
        }
      });

      my.active = tabs_order[state.active];

      /* Update tabs position. */
      tabs_order.forEach(position_tab);

      /* Update tabs state. */
      tabs_order.forEach(function(tab_id) {
        update_tab(tab_id, tabs_data[tab_id]);
      });
    }
  };

  /**************************************************************************/
  /* PUBLIC METHODS */
  /**************************************************************************/
  // ### select_tab
  //
  // Selects the given tab by `tab_id`
  // ```
  // @tab_id {string} the tab id
  // ```
  select_tab = function(tab_id) {
    if(tab_id !== my.active) {
      //console.log('select_tab: ' + id);
      my.socket.emit('select', tab_id);
    }
  };

  // ### close_tab
  //
  // Closes tabs by `tab_id`
  // ```
  // @tab_id {string} the tab id
  // ```
  close_tab = function(tab_id) {
    my.socket.emit('close', tab_id);
  };

  // ### cmd_back
  //
  // Issue a back command
  cmd_back = function() {
    my.socket.emit('back');
  };

  // ### cmd_back
  //
  // Issue a forward command
  cmd_forward = function() {
    my.socket.emit('forward');
  };

  // ### cmd_back
  //
  // Issue a new tab command
  cmd_new = function() {
    console.log('NEW!');
    my.socket.emit('new');
  };

  // ### init
  //
  // Initialises the controller
  init = function() {
    my.wrapper_el.bind('mousewheel', mousewheel_handler);
    my.socket = io.connect();
    my.socket.on('state', state_handler);
    my.socket.emit('handshake', '_strip');

    return that;
  };


  that.select_tab = select_tab;
  that.close_tab = close_tab;

  that.cmd_back = cmd_back;
  that.cmd_forward = cmd_forward;
  that.cmd_new = cmd_new;

  that.init = init;

  return that;
};
