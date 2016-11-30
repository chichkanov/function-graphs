var FA = (function(FA) {
    FA.context = window.location.hostname.split('.').pop() == 'lan' ? 'lan' : 'com';

    return FA;
} (FA || {}));

FA.Notification = (function() {
    var NOTIF_PRIV_MSG = 0,
        NOTIF_REPORT = 1,
        NOTIF_FRIEND_REQ = 2,
        NOTIF_GROUP_REQ = 3,
        NOTIF_FRIEND_CON = 4,
        NOTIF_WALL_MSG = 5,
        NOTIF_ABUSE = 6,
        NOTIF_TOPIC_WATCH = 7,
        
        _subscribed = {},
        _timeout = 35000,
        _domain = '',
        _days = [
            'Sun',
            'Mon',
            'Tue',
            'Wed',
            'Thu',
            'Fri',
            'Sat'
        ],
        _months = [
            'Jan',
            'Feb',
            'Mar',
            'Apr',
            'May',
            'Jun',
            'Jul',
            'Aug',
            'Sep',
            'Oct',
            'Nov',
            'Dec'
        ],
        
        _unread = 0,
        _timed = {},
        
        _registered = false,
        _storedItemsNum = 10,
        _store = {},
        _order = [],
        
        _useCORS = true,
        
        _filterEmpty = function(e) {
            return typeof e === 'undefined';
        },
        _filterRead = function(e) {
            return _store[e] && _store[e].read;
        },
		_refresh = function(channel, time) {
            if ( _timed[channel] ) {
                clearTimeout(_timed[channel]);
                delete _timed[channel];
            }
            var fn = function() {
                _request(channel);
                
                delete _timed[channel];
            };
            var delay = time || 0;
            var idleTime = FA.Window.getIdleTime();
            switch (true) {
                case idleTime > 900000 :
                    delay += 300;
                case idleTime > 600000 :
                    delay += 120;
                case idleTime > 300000 :
                    delay += 60;
                default :
                    delay += 5
            }
            FA.Debugger.log('Next request in... ' + delay + 's', channel);
            _timed[channel] = setTimeout(fn, delay * 1000);
        },
        _request = function(channel) {
            FA.Debugger.log('_request', channel, _subscribed[channel], '_useCORS : ' + _useCORS);
            if ( _subscribed[channel] )
            {
                var d = new Date();
                var date = [
                    _days[parseInt(d.getUTCDay())],
                    ', ',
                    new String(d.getUTCDate()),
                    ' ',
                    _months[parseInt(d.getUTCMonth())],
                    ' ',
                    d.getUTCFullYear(),
                    ' ',
                    new String(d.getUTCHours()),
                    ':',
                    new String(d.getUTCMinutes()),
                    ':',
                    new String(d.getUTCSeconds()),
                    ' GMT'
                ];
                if (date[2].length == 1) {
                    date[2] = '0' + date[2];
                }
                if (date[8].length == 1) {
                    date[8] = '0' + date[8];
                }
                if (date[10].length == 1) {
                    date[10] = '0' + date[10];
                }
                if (date[12].length == 1) {
                    date[12] = '0' + date[12];
                }
                
                var params = {
                    timeout: _timeout,
                    url: (_domain ? '//' + _domain : '') + '/sub/' + channel,
                    dataType : _domain && ! _useCORS ? 'jsonp' : 'json',
                    
                    beforeSend: function(xhr) {
                        if ( ! _domain ) {
                            xhr.setRequestHeader('If-None-Match', _subscribed[channel].tag || '0');
                            // Could not use this method due to inconsistency in date digits
                            xhr.setRequestHeader('If-Modified-Since', _subscribed[channel].lastModified || date.join(''));
                        }
                    },
                    error: function(xhr, txt, error) {
                        FA.Debugger.log('_request() : Error callback...', xhr.status, _domain);
                        switch (xhr.status) {
                            case 0 :
                                FA.Debugger.log('XMLHTTPRequest(' + this.url + ') ' + txt, error);
                                if ( _domain ) {
                                    if ( _useCORS && error == 'No Transport' ) {
                                        FA.Debugger.log('CORS enabled... disabling');
                                        _useCORS = false;
                                        _refresh(channel, 0);
                                    }
                                    else if ( txt == 'timeout' ) {
                                        _refresh(channel);
                                    }
                                    else if ( ! _useCORS ) {
                                        FA.Notification.unscribe(channel);
                                        FA.Notification.register();
                                    }
                                }
                                break;
                            case 403 :
                            case 404 :
                                FA.Notification.unscribe(channel);
                                FA.Notification.register();
                                break;
                            default :
                                _refresh(channel, _domain && ! _useCORS ? 0 : 60);
                        }
                    },
                    success: function(data, txt, xhr) {
                        switch (xhr.status) {
                            case 200 :
                                if (  ! jQuery.isArray(data) ) {
                                    data = [data];
                                }
                                data = jQuery.grep(data, _filterEmpty, true);
                                FA.Debugger.log('XMLHTTPRequest(' + this.url + ') : 200 Success', jQuery.extend({}, data));
                                if (_subscribed[channel]) {
                                    if ( ! _domain ) {
                                        _subscribed[channel].lastModified = xhr.getResponseHeader('Last-Modified');
                                        _subscribed[channel].tag = xhr.getResponseHeader('Etag');
                                    }
                                    else {
                                        _subscribed[channel].lastModified = data[data.length - 1].time;
                                        _subscribed[channel].tag = data[data.length - 1].tag;
                                    }
                                    if ( ! data ) {
                                        FA.Debugger.log('XMLHTTPRequest(' + this.url + ') : No data');
                                    }
                                    else if ( ! jQuery.isArray(data) ) {
                                        FA.Debugger.log('XMLHTTPRequest(' + this.url + ') : Not an array');
                                    }
                                    else {
                                        FA.Debugger.log(jQuery.extend({}, data));
                                        _tmp = data;
                                        for ( i in _tmp ) {
                                            if ( typeof _tmp[i] == 'function' ) continue;
                                                        FA.Debugger.log(i, jQuery.extend({}, _tmp[i]));
                                                        switch ( typeof _tmp[i].text ) {
                                                            case 'object' :
                                                                break;
                                                            case 'string' :
                                                                if ( _tmp[i].text == 'refresh' ) {
                                                                    FA.Notification.unscribe(channel);
                                                                    FA.Notification.register();
                                                        return false;
                                                    }
                                                default :
                                                    delete data[i];
                                            }
                                        }
                                        if ( data.length ) _storeItems(data, false, true);
                                    }
                                    _refresh(channel);
                                }
                                break;
                            case 304 :
                                if (_subscribed[channel]) {
                                    _refresh(channel);
                                }
                                break;
                        }
                    }
                };
                if ( _domain ) {
                    if ( ! _useCORS ) params.processData = false;
                    params.data = 'tag=' + window.escape(_subscribed[channel].tag || '0') + '&time=' + window.escape(_subscribed[channel].lastModified || date.join(''));
                }
                try {
                    _subscribed[channel].xhr = $.ajax(params);
                }
                catch (e) {
                }
            }
        },
        _storeItems = function(data, numUnread, update) {
            var _tmp = [],
                _map = [],
                _offset,
                _countUnread = numUnread === false,
                
                _notified = 0,
                _backup,
                i;

            FA.Debugger.log('FA.Notifications._storeItems #1', _countUnread);
            if ( ! _countUnread ) {
                _unread = parseInt(numUnread, 10);
            }
            
            if ( update ) {
                _tmp = _order.slice(0);
                for ( i in _tmp ) {
                    if ( typeof _tmp[i] == 'function' ) continue;
                    _map.push(true);
                }
            }
            
            FA.Debugger.log('FA.Notifications._storeItems #1', jQuery.extend({}, data), jQuery.extend({}, _map), jQuery.extend({}, _tmp), jQuery.extend({}, _order), _unread);

            if(data.length == 0) {
                $('#notif_list .unread').remove();
                Toolbar._alignNotifications();
            }

            for ( i in data ) {
                if ( typeof data[i] == 'function' ) continue;
                _backup = data[i].text.type != FA.Notification.NOTIF_FRIEND_CON;
                
                if ( ! data[i].read ) {
                    if ( _countUnread && _backup ) {
                        ++_unread;
                    }
                    if ( update ) {
                        notify({body: Toolbar.compileNotif(data[i]), delay: _notified * 1000});
                        ++_notified;
                    }
                }
                if ( data[i].text.id && ! _store[data[i].text.id] && _backup ) {
                    _store[data[i].text.id] = data[i];
                    _offset = -1;
                }
                else {
                    if ( data[i].read && ! _store[data[i].text.id].read ) _store[data[i].text.id].read = 1;
                    _offset = jQuery.inArray(data[i].text.id, _order);
                }
                if ( _backup ) {
                    _map.push(_offset == -1 ? null : _offset);
                    _tmp.push(data[i].text.id);
                }
            }

            for ( i in _store ) {
                if ( typeof _store[i] == 'function' ) continue;
                i = parseInt(i);
                FA.Debugger.log(i, _order, jQuery.inArray(i, _tmp));
                if ( jQuery.inArray(i, _tmp) == -1 || _tmp.length == 0) {
                    $('#notif_list #n' + _store[i].text.id).remove();
                    delete _store[i];
                }
            }

            FA.Debugger.log('FA.Notifications._storeItems #2', jQuery.extend({}, data), jQuery.extend({}, _map), jQuery.extend({}, _tmp), jQuery.extend({}, _order), _unread);
            
            _order = _tmp.slice(- _storedItemsNum);

            FA.Debugger.log('FA.Notifications._storeItems #3', jQuery.extend({}, data), jQuery.extend({}, _map), jQuery.extend({}, _tmp), jQuery.extend({}, _order), _unread);
            Toolbar.refresh({map: _map, set: _tmp, data: jQuery.extend({}, _store), unread: _unread, max: _storedItemsNum, clear: ! update});
        },
        _focus = function(e) {
            //_unread = 0;
            for ( i in _timed ) {
                if ( typeof _timed[i] == 'function' ) continue;
                FA.Debugger.log('_focus', i);
                _refresh(i);
            }
        },
        markAsRead = function() {
            var _tmp = jQuery.grep(_order, _filterRead, true);

            FA.Debugger.log('markAsRead', _tmp);
            
            if ( _tmp.length ) {
                $.ajax({
                    url: '/notification.forum',
                    type: 'POST',
                    data: {id: _tmp},
                    dataType: 'json',
                    
                    error: function(xhr, txt, error) {
                    },
                    success: function(data, txt, xhr) {
                        for ( i in _tmp ) {
                            if ( typeof _tmp[i] == 'function' ) continue;
                            _store[_tmp[i]].read = 1;
                            --_unread;
                        }
                        FA.Debugger.log('markAsRead()', _unread);
                        Toolbar.refresh({unread: _unread});
                    }
                });
            }
        },
        delItem = function(o) {
            var _o,
                _index = o.index;
                
            FA.Debugger.log(o, _order[_index], jQuery.extend({},_store));
            o.index = _order[_index];
            
            if ( _store[o.index] ) {
                FA.Debugger.log('delItem() : ', o.index, jQuery.extend({}, _store[o.index]), _store[o.index].channel);
                _o = _subscribed[_store[o.index].channel];
                _o.channel = _store[o.index].channel;
                unscribe(_o.channel);
                if ( _store[o.index].text.id ) {
                    $.ajax({
                        url: '/notification.forum',
                        type: 'DELETE',
                        data: {id: _store[o.index].text.id, channel: _o.channel},
                        dataType: 'json',
                        
                        error: function(xhr, txt, error) {
                            FA.Debugger.log('delItem() : Error callback...', xhr.status);
                            FA.Notification.register();
                        },
                        success: function(data, txt, xhr) {
                            FA.Debugger.log(_index, jQuery.extend({}, _store[o.index]));
                            if ( ! _store[o.index].read ) {
                                --_unread;
                            }
                            delete _store[_order.splice(_index, 1)];
                            data.store = jQuery.grep(data.store, _filterEmpty, true);
                            FA.Debugger.log(_subscribed, _o, data.store);
                            if ( data.store && data.store.length ) {
                                _storeItems(data.store, _unread);
                            }
                            subscribe(_o);
                        }
                    });
                }
            }
            else {
                FA.Debugger.log(o);
            }
        },
        getStore = function() {
            return _store;
        },
        notify = function(options) {
            var defaults = {
                    icon: 'http://illiweb.' + FA.context + '/fa/notifications/notifications.png',
                    title: "",
                    body: "",
                    timeout: 5000,
                    sticky: false,
                    id: null,
                    type: 'normal',
                    url: '',
                    dir: '',
                    onClick: function() {},
                    onShow: function() {},
                    onClose: function() {},
                    onError: function() {}
                },
                p = this,
                noti = null,

                init = function() {
                    p.set = $.extend({}, defaults, options);
                    if(isSupported()) {
                        if(window.webkitNotifications.checkPermission() != 0){
                            getPermissions(init);
                        }
                        else {
                            if(p.set.type === 'normal') createNoti();
                            else if(p.set.type === 'html') createNotiHtml();
                        }
                    } else {
                        _createNotif();
                    }
                },
                _createNotif = function() {

                    var _div = document.createElement('div'),
                        _content = document.createElement('div'),
                        _fn;
                        
                    $(_content).addClass('content ellipsis').html(p.set.body);
                    $(_div).addClass('fa_notification').append(_content);
                    $('#' + Toolbar.LIVE_NOTIF).prepend($(_div).css('opacity', 0.001));
                    $(_content).dotdotdot();
                    $(_div).hide().css('opacity', 0.8);

                    // Thomas 06/11/2013 - FadeIn / FadeOut + delay sur fenêtre de notification si pas de survol
                    $(_div).fadeIn(100, function() {
                        $(_div).delay(10000).fadeOut();
                        $(_div).mouseover(function() {
                            $(_div).stop(true, true);
                        });
                        $(_div).mouseleave(function() {
                            $(_div).delay(5000).fadeOut();
                        });
                    });
                },
                createNoti = function() {
                    noti = window.webkitNotifications.createNotification(p.set.icon, p.set.title, p.set.body);

                    if(p.set.dir) noti.dir = p.set.dir;
                    if(p.set.onclick) noti.onclick = p.set.onclick;
                    if(p.set.onshow) noti.onshow = p.set.onshow;
                    if(p.set.onclose) noti.onclose = p.set.onclose;
                    if(p.set.onerror) noti.onerror = p.set.onerror;
                    if(p.set.id) noti.replaceId = p.set.id;
                    noti.show();
                    if(!p.set.sticky) setTimeout(function(){ noti.cancel(); }, p.set.timeout);
                },
                createNotiHtml = function() {
                    noti = window.webkitNotifications.createHTMLNotification(p.set.url);

                    if(p.set.dir) noti.dir = p.set.dir;
                    if(p.set.onclick) noti.onclick = p.set.onclick;
                    if(p.set.onshow) noti.onshow = p.set.onshow;
                    if(p.set.onclose) noti.onclose = p.set.onclose;
                    if(p.set.onerror) noti.onerror = p.set.onerror;
                    if(p.set.id) noti.replaceId = p.set.id;
                    noti.show();
                    if(!p.set.sticky) setTimeout(function(){ noti.cancel(); }, p.set.timeout);
                },
                isSupported = function() {
                    return false;
                },
                getPermissions = function(callback) {
                    window.webkitNotifications.requestPermission(callback);
                };

            p.set = {};
            init();
		},
        register = function() {
            _registered = false;
            $.ajax({
                url: '/notification.forum',
                dataType: 'json',
                
                error: function(xhr, txt, error) {
                    FA.Debugger.log('Could not register on push server');
                },
                success: function(data, txt, xhr) {
                    _registered = true;
                    //if ( data.store && data.store.length ) {
                        _storeItems(data.store, data.unread);
                    //}
                    _domain = data.push.domain != window.location.host ? data.push.domain : false;
                    subscribe(data.push);
                }
            });
        },
        registered = function() {
            return _registered;
        },
        subscribe = function(o) {
            if (! _subscribed[o.channel]) {
                _subscribed[o.channel] = {};
                if ( o.lastModified ) {
                    _subscribed[o.channel].lastModified =  o.lastModified;
                }
                if ( o.tag ) {
                    _subscribed[o.channel].tag =  o.tag;
                }
                FA.Debugger.log(o);
                _refresh(o.channel);
            }
        },
        getSubscribedChannels = function() {
            return _subscribed;
        },
        test = function(channel) {
            unscribe(channel);
            register();
        },
        unscribe = function(channel) {
            if ( _subscribed[channel] ) {
                if (_subscribed[channel].xhr) {
                    _subscribed[channel].xhr.abort();
                }
                delete _subscribed[channel];
            }
        };
        
    $(window).focus(_focus);

    return {
//		NOTIF_PRIV_MSG: 0,
//		NOTIF_REPORT: 1,
//		NOTIF_FRIEND_REQ: 2,
//		NOTIF_GROUP_REQ: 3,
//		NOTIF_FRIEND_CON: 4,
//		NOTIF_WALL_MSG: 5,
//		NOTIF_ABUSE: 6,
//		NOTIF_TOPIC_WATCH: 7,
		
        NOTIF_PRIV_MSG: NOTIF_PRIV_MSG,
        NOTIF_REPORT: NOTIF_REPORT,
        NOTIF_FRIEND_REQ: NOTIF_FRIEND_REQ,
        NOTIF_GROUP_REQ: NOTIF_GROUP_REQ,
        NOTIF_FRIEND_CON: NOTIF_FRIEND_CON,
        NOTIF_WALL_MSG: NOTIF_WALL_MSG,
        NOTIF_ABUSE: NOTIF_ABUSE,
        NOTIF_TOPIC_WATCH: NOTIF_TOPIC_WATCH,
		
        getSubscribedChannels: getSubscribedChannels,
        test: test,
        delItem: delItem,
        getStore: getStore,
        markAsRead: markAsRead,
        register: register,
        registered : registered,
        subscribe: subscribe,
        unscribe: unscribe
    };
}());

FA.Window = (function() {
    var _focused = true,
    
        _blur = function() {
            FA.Debugger.log('Blur...');
            if ( _focused ) {
                _focused = false;
                _idleSince = new Date().getTime();
            }
        },
        _focus = function() {
            FA.Debugger.log('Focus...');
            _focused = true;
            _idleSince = 0;
            if ( _title ) {
                document.title = _title;
                _title = false;
            }
        },
        _idleSince = 0,
        _title = false,

        loaded = false,

        getIdleTime = function() {
            return _focused ? 0 : new Date().getTime() - _idleSince;
        },
        notify = function(msg) {
        };

    $(window).focus(_focus).blur(_blur);
    $(window).load(function() {loaded = true;});

    return {
        loaded: loaded,
        getIdleTime: getIdleTime,
        notify: notify
    };
}());

FA.Debugger = (function() {
    var _debug = false,

        log = function() {
            if ( _debug  ) {
                if ( ! window.console ) {
                    if ( ! document.getElementById('console_log') ) {
                        $(document.body).append('<div id="console_log" style="position: fixed; top: 0; right: 0; width: 600px; height: 400px;"></div>');
                    }
                    $('#console_log').append('<p>' + new Date().toUTCString() + ' ' + arguments[0] + '</p>');
                }
                else if (window.console.log.apply) {
                    var message = [].slice.call(arguments);
                    message.unshift(new Date().toUTCString());
                    window.console.log.apply(window.console, message);
                }
                else {
                    window.console.log(new Date().toUTCString(), JSON.stringify(arguments));
                }
            }
        },
        debug = function(bool) {
            _debug = bool === true;
        };

        return {
            debug: debug,
            log: log
        };
}());

FA.ImageHandler = (function() {
    var _imageStack = [],
        _images = [],
        _isClean = true,

        _height = 0,
        _width = 0,
        _ratio = 0,

        _viewport = {
            height: 0,
            width: 0
        },
        _window = {},

        _clean = function() {
            var i, j;
            for ( i = 0, j = _imageStack.length; i < j; ++i ) {
                if ( ! _imageStack[i] ) {
                    _imageStack.splice(i, 1);
                }
                if ( ! _images[i] ) {
                    _images.splice(i, 1);
                }
            }
        },
        _onclick = function(e) {
            var o,
                _resizable = e.target.parentNode && e.target.parentNode.parentNode && e.target.parentNode.parentNode.parentNode;
            if ( _resizable && $(_resizable).hasClass('resizebox') ) {
                FA.Debugger.log($.inArray(e.target.parentNode.parentNode.parentNode.nextSibling.nextSibling, _imageStack));
                o = _images[$.inArray(e.target.parentNode.parentNode.parentNode.nextSibling.nextSibling, _imageStack)];
                switch ( true )
                {
                    case ! o:
                        break;
                    case $(e.target).hasClass('enlarge') :
                        _expand(o);
                        return false;
                    case $(e.target).hasClass('resize') :
                        _shrink(o);
                        return false;
                    case $(e.target).hasClass('fullsize') :
                        window.open('/viewimage.forum?u=' + encodeURIComponent(o.img.src));
                        return false;
                }
            }
        },
		_onerror = function(e) {
			FA.Debugger.log('Could not load image[src=' + this.src + ']');
			delete _imageStack[e.data.index];
			delete _images[e.data.index];
			_isClean = false;
		},
		_onload = function(e) {
			_resize(e.data.o);
		},
		_onresize = function() {
			FA.Debugger.log('Resizing window... checking images sizes !!', _viewport.height, _viewport.width, _window.height(), _window.width());
			if ( _window.height() != _viewport.height || _window.width() != _viewport.width ) {
				_viewport.height = _window.height();
				_viewport.width = _window.width();
				_preprocess();
			}
		},
		_preprocess = function() {
			var i, o;
			
			FA.Debugger.log('Preprocessing...');
			if ( ! _isClean ) {
				_clean();
			}
			$('.resize_limit,.resizebox,.resizebox_spacer').remove();
			$('<div class="resize_limit"></div>').insertBefore($(_imageStack));
			for ( i in _images ) {
				if ( typeof _images[i] == 'function' ) continue;
				o = _images[i];
				if ( typeof o === 'undefined' || o.pre ) {
					_resize(o);
					continue;
				}
				o.img.src = 'http://www.illiweb.' + FA.context + '/fa/empty.gif';
				
                o.pre = new Image();
                $(o.pre).one('load', {o : o}, _onload);
                $(o.pre).one('error', {img: o.img, index: i}, _onerror);
                o.pre.src = o.src;
			}
		},
		_resize = function(o) {
			var _imgWidth = o.defaultWidth || o.pre.width,
				_imgHeight = o.defaultHeight || o.pre.height,
				_imgRatio,
				_prev = o.img.previousSibling,
				_maxWidth = _prev.offsetWidth,
				_limitedWidth = _width ? _maxWidth < _width : true,
				_fullsizable = o.pre.width <= _maxWidth,
				_finalWidth = _limitedWidth ? _maxWidth : _width,
				_finalHeight = _maxWidth / _imgRatio < _height || ! _height ? _maxWidth / _imgRatio : _height;
			
			FA.Debugger.log('FA.ImageHandler._resize()');
			
			if ( o.defaultRatio ) {
				_imgRatio = o.defaultRatio;
			}
			else {
				_imgRatio = o.pre.width / o.pre.height;
			}

			FA.Debugger.log('Resizing image[src="' + o.pre.src + '",width="' + _imgWidth + '",height="' + _imgHeight + '"]',_imgRatio, o, _limitedWidth);

			if ( _imgWidth > _finalWidth || _imgHeight > _finalHeight ) {
				FA.Debugger.log(o.pre.width, o.pre.height, _imgRatio, _finalWidth, _finalHeight, _maxWidth);
				if ( _imgRatio > _ratio ) {
					if ( o.resized || ! _fullsizable ) {
						o.img.width = (o.resized ? _finalWidth : _maxWidth);
					}
				}
				else {
					if ( o.resized || ! _fullsizable ) {
						o.img.width = (o.resized ? _finalHeight * _imgRatio : _maxWidth);
					}
				}
				if ( o.defaultWidth ) {
					o.img.style.width = '';
				}
				if ( o.defaultHeight ) {
					o.img.style.height = '';
				}
				if ( o.defaultRatio ) {
					o.img.height = o.img.width / _imgRatio;
				}
				var txt		=	'<span class="resizebox gensmall clearfix' + ( _fullsizable ? '' : ' showfull' ) + ( o.resized ? '' : ' enlarged' ) + '">';
					txt		+=		'<span class="resize_border clearfix">';
					txt		+=			'<span class="resize_content clearfix">';
				if ( ! _limitedWidth ) {
					txt		+=				'<a href="#" class="enlarge">' + FA.Lang['Image_enlarge'] + '</a>';
					txt		+=				'<a href="#" class="resize">' + FA.Lang['Click_to_resize'] + '</a>';
					txt		+=				'<span class="resize_filler"> </span>';
				}
				if ( ! _fullsizable ) {
					txt		+=				'<a href="#" class="fullsize">' + FA.Lang['Click_to_see_fullsize'] + '</a>';
				}
					txt		+=			'</span>';
					txt		+=		'</span>';
					txt		+=	'</span>';
					txt		+=	'<br class="resizebox_spacer" />';
				$(_prev).after(txt);
				o.img.previousSibling.previousSibling.style.width = o.img.offsetWidth + 'px';
				o.img.src = o.pre.src;
			}
			else {
				o.img.src = o.pre.src;
				$(_prev).remove();
			}
		},

		_expand = function(o) {
			FA.Debugger.log('Expanding...');
			o.resized = false;
			o.initWidth = o.img.width;
			o.img.width = Math.min(o.pre.width, o.img.previousSibling.previousSibling.previousSibling.offsetWidth);
			if ( o.defaultRatio ) {
				o.initHeight = o.img.height;
				o.img.height = o.img.width / o.defaultRatio;
			}
			$(o.img.previousSibling.previousSibling).width(o.img.width).addClass('enlarged');
		},
		_shrink = function(o) {
			o.resized = true;
			o.img.width = o.initWidth;
			if ( o.defaultRatio ) {
				o.img.height = o.initHeight;
			}
			$(o.img.previousSibling.previousSibling).width(o.initWidth).removeClass('enlarged');
		},

		pop = function() {
			return _imageStack.pop();
		},
		push = function() {
			if ( arguments[0].push ) {
				_imageStack.push.apply(_imageStack, arguments[0]);
			}
			else {
				_imageStack.push.apply(_imageStack, arguments);
			}
		},
		shift = function() {
			return _imageStack.shift();
		},
		unshift = function() {
			if ( arguments[0].unshift ) {
				_imageStack.unshift.apply(_imageStack, arguments[0]);
			}
			else {
				_imageStack.unshift.apply(_imageStack, arguments);
			}
		},

		setWidth = function(x) {
			_width = x;
		},
		setHeight = function(y) {
			_height = y;
		},

		preload = function() {
			var img;

			if ( _imageStack.length ) {
				_ratio = _height ? _width / _height : 0;
				for ( i in _imageStack ) {
					if ( typeof _imageStack[i] == 'function' ) continue;
					img = _imageStack[i];
					_images[i] = {
						img: img,
						src: img.src,
						resized: true,
						defaultWidth: parseInt((img.style && img.style.width) || img.getAttribute('width'),10) || false,
						defaultHeight: parseInt((img.style && img.style.height) || img.getAttribute('height'),10) || false,
						defaultRatio: parseInt((img.style && img.style.width) || img.getAttribute('width'),10) / parseInt((img.style && img.style.height) || img.getAttribute('height'),10) || false
					};
				}
				_window = $(window);
				_viewport.height = _window.height();
				_viewport.width = _window.width();
				_preprocess();
				$(window).resize(_onresize);
				$(window.document).bind('click', _onclick);
			}
		};

		return {
			pop : pop,
			push : push,
			shift : shift,
			unshift : unshift,

			setHeight: setHeight,
			setWidth: setWidth,

			preload: preload
		};
}());