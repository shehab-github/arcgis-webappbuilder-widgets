///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 - 2018 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define([
    'dojo/_base/declare',
    'jimu/BaseWidget',
    'dojo/topic',
    'dojo/query',
    'dojo/_base/html',
    'dojo/_base/lang',
    'dojo/_base/array',
    "esri/webscene/Slide",
    "dojo/dom-construct",
    "dijit/ConfirmDialog"
], function (declare, BaseWidget, topic, query, html, lang, array, Slide, domConstruct, ConfirmDialog) {
    var clazz = declare([BaseWidget], {

        name: 'Slides',
        baseClass: 'jimu-widget-slides',

        _selfHeight: 0,
        _isExpand: false,
        _marginLeading: "marginLeft",
        _marginTrailing: "marginRight",
        _isSlideBarMoving: false,
        _timeoutId: -1,

        postCreate: function () {
            this.inherited(arguments);
            if (window.isRTL) {
                this._marginLeading = "marginRight";
                this._marginTrailing = "marginLeft";
            } else {
                this._marginLeading = "marginLeft";
                this._marginTrailing = "marginRight";
            }
            this.slideBar.style.marginLeft = 0;
            this.slideBar.style.marginRight = 0;
            this._disableArrowIcon(this.leadingArrowIcon);
            this._disableArrowIcon(this.trailingArrowIcon);
            if (!this.isOnScreen) {
                html.addClass(this.domNode, 'slides-in-widget-pool');
            }
            if (window._layoutManager) {
                this.own(topic.subscribe("beforeLayoutChange",
                                         lang.hitch(this, this._onBeforeLayoutChange)));
                this.own(topic.subscribe("afterLayoutChange",
                                         lang.hitch(this, this._onAfterLayoutChange)));
            }
            this._createSlides();
            this._newSlideTitleDialog = new ConfirmDialog({
                id: "newSlideTitle_dlg",
                title: "New slide title",
                content: "<input type='text' id='txt_newSlideTitle'/>",
                style: "width: 175px"
            });

            this._newSlideTitleDialog.set('onExecute', lang.hitch(this, this._addNewSlide));
        },

        onOpen: function () {
            this.inherited(arguments);
            this._expand();
        },

        onClose: function () {
            this.inherited(arguments);
            this._collapse();
        },

        setPosition: function (position, containerNode) {
            //make sure always put Slides into map
            if (arguments[1] === this.sceneView.map.id) {
                this.inherited(arguments);
            } else {
                containerNode = this.sceneView.map.id;
                this.setPosition(position, containerNode);
            }
        },

        resize: function () {
            this._clearTimeoutId();
            this.slideBar.style.marginLeft = 0;
            this.slideBar.style.marginRight = 0;
            this._updateSlideBar();
        },

        destroy: function () {
            this._collapse();
            this.inherited(arguments);
        },

        _onBeforeLayoutChange: function () {
            this._isExpandBeforeLayoutChagne = this._isExpand;
            if (this._isExpand) {
                this._collapse();
            }
        },

        _onAfterLayoutChange: function () {
            if (this._isExpandBeforeLayoutChagne) {
                this._expand();
            }
            this._isExpandBeforeLayoutChagne = this._isExpand;
        },

        _createSlides: function () {
            var slides = this.sceneView.map.presentation.slides;
            if (slides && slides.length > 0) {
                slides.forEach(lang.hitch(this, function (slide) {
                    var str = '<li class="slide">' +
                      '<div class="slide-div">' +
                      '<button class="slide-remove-btn" title="Remove">x</button>' +
                        '<img class="thubnail" src="' + slide.thumbnail.url + '">' +
                        '<div class="small-title">' + slide.title.text + '</div>' +
                      '</div>' +
                    '</li>';
                    var li = html.toDom(str);
                    html.place(li, this.slideBar);
                    var slideDiv = query(".slide-div", li)[0];
                    slideDiv.slide = slide;
                    var delBtn = query(".slide-remove-btn", li)[0];
                    delBtn.slide = slide;
                }));
            }
            var addNewDom = '<li class="slide">' +
                             '<div class="slide-div">' +
                               '<img class="thubnail addNew" src="widgets/slides/images/add.png">' +
                               '<div class="small-title">Add new</div>' +
                             '</div>' +
                            '</li>';
            var li = html.toDom(addNewDom);
            html.place(li, this.slideBar);
        },

        _onIconClicked: function () {
            this._expand();
        },

        _expand: function () {
            if (this._isExpand) {
                return;
            }

            this._isExpand = true;
            html.addClass(this.domNode, 'expand');
            html.addClass(this.sceneView.container, 'slide-widget-expand');
            this._selfHeight = this.domNode.clientHeight;
            var deltaY = this._selfHeight;
            this._offsetBottom(deltaY);
            this._updateSlideBar();
        },

        _offsetBottom: function (deltaY) {
            var widgets = this._getBottomPositionOnScreenOffPanelWidgets();
            if (widgets && widgets.length > 0) {
                array.forEach(widgets, lang.hitch(this, function (widget) {
                    var newPosition = lang.clone(widget.getPosition());
                    newPosition.bottom += deltaY;
                    widget.setPosition(newPosition);
                }));
            }

            var placeholders = this._getBottomPositionPlaceholders();
            if (placeholders && placeholders.length > 0) {
                array.forEach(placeholders, lang.hitch(this, function (placeholder) {
                    var newPosition = lang.clone(placeholder.position);
                    newPosition.bottom += deltaY;
                    placeholder.moveTo(newPosition);
                }));
            }

            var widgetIcons = this._getBottomPositionWidgetIcons();
            if (widgetIcons && widgetIcons.length > 0) {
                array.forEach(widgetIcons, lang.hitch(this, function (widgetIcon) {
                    var newPosition = lang.clone(widgetIcon.position);
                    newPosition.bottom += deltaY;
                    widgetIcon.moveTo(newPosition);
                }));
            }
        },

        _updateSlideBar: function () {
            this._isSlideBarMoving = false;
            var slideBarDivWidth = this.slideBarDiv.clientWidth;
            var slideBarWidth = this.slideBar.clientWidth;
            if (slideBarDivWidth > slideBarWidth) {
                html.removeClass(this.domNode, "show-arrow-icons");
                this.slideBar.style.marginLeft = 0;
                this.slideBar.style.marginRight = 0;
                this._disableArrowIcon(this.leadingArrowIcon);
                this._disableArrowIcon(this.trailingArrowIcon);
            } else {
                html.addClass(this.domNode, "show-arrow-icons");
                var marginLeading = html.getStyle(this.slideBar, this._marginLeading);
                //trailing arrow icon
                var newMarginLeading1 = marginLeading - slideBarDivWidth;
                var shouldEnableTrailingArrow = (newMarginLeading1 + slideBarWidth) > 0;
                if (shouldEnableTrailingArrow) {
                    this._enableArrowIcon(this.trailingArrowIcon);
                } else {
                    this._disableArrowIcon(this.trailingArrowIcon);
                }

                //leading arrow icon
                var newMarginLeading2 = marginLeading + slideBarDivWidth;
                var shouldEnableLeadingArrow = newMarginLeading2 < slideBarDivWidth;
                if (shouldEnableLeadingArrow) {
                    this._enableArrowIcon(this.leadingArrowIcon);
                } else {
                    this._disableArrowIcon(this.leadingArrowIcon);
                }
            }
        },

        _clearTimeoutId: function () {
            if (this._timeoutId > 0) {
                clearTimeout(this._clearTimeoutId);
            }
            this._timeoutId = -1;
        },

        _onLeadingArrowIconClicked: function () {
            if (this.leadingArrowIcon.isEnabled) {
                this._moveToTrailingDirection();
            }
        },

        _onTrailingArrowIconClicked: function () {
            if (this.trailingArrowIcon.isEnabled) {
                this._moveToLeadingDirection();
            }
        },

        _moveToLeadingDirection: function () {
            if (this._isSlideBarMoving) {
                return;
            }
            this._clearTimeoutId();
            var slideBarDivWidth = this.slideBarDiv.clientWidth;
            var marginLeading = html.getStyle(this.slideBar, this._marginLeading);
            var newMarginLeading = marginLeading - slideBarDivWidth;
            this._isSlideBarMoving = true;
            this.slideBar.style[this._marginLeading] = newMarginLeading + "px";

            this._timeoutId = setTimeout(lang.hitch(this, function () {
                this._updateSlideBar();
            }), 600);
        },

        _moveToTrailingDirection: function () {
            if (this._isSlideBarMoving) {
                return;
            }
            this._clearTimeoutId();
            var slideBarDivWidth = this.slideBarDiv.clientWidth;
            var marginLeading = html.getStyle(this.slideBar, this._marginLeading);
            var newMarginLeading = marginLeading + slideBarDivWidth;
            this._isSlideBarMoving = true;
            this.slideBar.style[this._marginLeading] = newMarginLeading + "px";

            this._timeoutId = setTimeout(lang.hitch(this, function () {
                this._updateSlideBar();
            }), 600);
        },

        _enableArrowIcon: function (arrowIcon) {
            html.addClass(arrowIcon, "enabled");
            arrowIcon.isEnabled = true;
        },

        _disableArrowIcon: function (arrowIcon) {
            html.removeClass(arrowIcon, "enabled");
            arrowIcon.isEnabled = false;
        },

        _onSlideCloseClicked: function () {
            if (this.isOnScreen) {
                if (this.closeable) {
                    this.widgetManager.closeWidget(this);
                } else {
                    this._collapse();
                }
            } else {
                this.widgetManager.closeWidget(this);
            }
        },

        _collapse: function () {
            if (!this._isExpand) {
                return;
            }

            this._isExpand = false;
            html.removeClass(this.domNode, 'expand');
            html.removeClass(this.sceneView.container, 'slide-widget-expand');
            this._clearTimeoutId();
            var deltaY = -this._selfHeight;
            this._offsetBottom(deltaY);
        },

        _getBottomPositionOnScreenOffPanelWidgets: function () {
            var widgets = this.widgetManager.getOnScreenOffPanelWidgets();
            if (widgets && widgets.length > 0) {
                widgets = array.filter(widgets, lang.hitch(this, function (widget) {
                    var position = widget.getPosition();
                    return (widget !== this && position &&
                      typeof position.bottom === 'number' && position.relativeTo === "map");
                }));
            }
            if (!widgets) {
                widgets = [];
            }
            return widgets;
        },

        _getBottomPositionPlaceholders: function () {
            var placeholders = [];
            if (window._layoutManager && window._layoutManager.widgetPlaceholders) {
                placeholders = array.filter(window._layoutManager.widgetPlaceholders,
                  lang.hitch(this, function (item) {
                      return item.position && typeof item.position.bottom === "number";
                  }));
            }
            return placeholders;
        },

        _getBottomPositionWidgetIcons: function () {
            var widgetIcons = [];
            if (window._layoutManager && window._layoutManager.preloadWidgetIcons) {
                widgetIcons = array.filter(window._layoutManager.preloadWidgetIcons,
                  lang.hitch(this, function (item) {
                      return item.position && typeof item.position.bottom === "number";
                  }));
            }
            return widgetIcons;
        },

        _onSlideBarClicked: function (event) {
            var target = event.target || event.srcElement;
            if (target.slide) {
                if (target.tagName.toLowerCase() === "button")
                    this._removeSlide(target.slide);
                else
                    target.slide.applyTo(this.sceneView);
            }
            else {
                this._newSlideTitleDialog.show();
            }
        },

        _addNewSlide: function () {

            Slide.createFrom(this.sceneView).then(lang.hitch(this, function (slide) {
                slide.title.text = document.getElementById("txt_newSlideTitle").value;
                this.sceneView.map.presentation.slides.add(slide);

                domConstruct.empty(this.slideBar);
                this._createSlides();

                this._newSlideTitleDialog.hide();
                document.getElementById("txt_newSlideTitle").value = "";
            }));

        },

        _removeSlide: function (slide) {
            this.sceneView.map.presentation.slides.remove(slide);

            domConstruct.empty(this.slideBar);

            this._createSlides();
        }

    });

    return clazz;
});