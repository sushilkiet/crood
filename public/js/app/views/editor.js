define(function (require, exports, module) {
    "use strict";

    var Backbone = require("backbone"),
        _ = require("underscore"),
        ace = require("ace/ace"),
        animate = require("app/animations"),
        debug = require("utils/debug")("views/editor");

    var editorElementId = "editor";

    module.exports = Backbone.View.extend({
        tagName: "pre",

        initialize: function () {
            this.$el.attr("id", this.elementId);

            this.listenTo(this.model, "change:filePath", this.loadFile);
            this.listenTo(this.model, "change:fileExt", this.setSyntaxMode);
            this.listenTo(this.model, "change:filePath", function () {
                this.disableCursorChangeHandler();
                this.once("contentShown", function () {
                    this.enableCursorChangeHandler();
                });
            });
        },

        events: {
            "drop": function (event) {
                var _this = this,
                    filePath = this.dummyFilePath;

                var files = event.originalEvent.dataTransfer.files;

                if (files.length) {
                    _this.model.set("filePath", filePath);
                    return false;
                }
            }
        },

        isCursorChangeHandlerActive: true,
        disableCursorChangeHandler: function () {
            this.isCursorChangeHandlerActive = false;
        },
        enableCursorChangeHandler: function () {
            this.isCursorChangeHandlerActive = true;
        },
        
        loadFile: function () {
            var filePath = this.model.get("filePath"),
                _this = this;
            
            if (!filePath) {
                debug("No file to show!");
                this.changeContent(this.helpContent);
                this.model.set("fileExt", this.defaultFileExt);
                return;
            }
            var fileExt;
            try {
                fileExt = filePath.match(this.fileExtRegExp)[0].slice(1);
                debug("New file has extension: " + fileExt);
                this.model.set("fileExt", fileExt);
            } catch (e) {
                debug("No file extension found for selected file! Showing as text.");
                this.model.set("fileExt", this.defaultFileExt);
            }

            debug("Fetching file: " + filePath);
            var model = this.model;
            $.getJSON("cat?path=" + filePath, function (res) {
                debug("File data successfully fetched!");
                _this.changeContent(res.data);
            });
        },

        setSyntaxMode: function () {
            var fileExt = this.model.get("fileExt"),
                syntaxMode = this.modes[fileExt] || fileExt;

            debug("Setting syntax mode to: " + syntaxMode);
            this.aceEditor.getSession().setMode("ace/mode/" + syntaxMode);
        },

        changeContent: function (content) {
            var contentArea = this.contentAreaCss ? this.$el.find(this.contentAreaCss) : this.$el,
                editor = this.aceEditor;

            debug("Changing content and fading it in..");
            animate.fadeIn(contentArea);
            editor.setValue(content);
            editor.clearSelection();
            editor.gotoLine(1);
            editor.moveCursorToPosition(this.getLastCursorPosition());
            this.trigger("contentShown");
        },

        lastPositionKey: function (filePath) {
            if (!filePath) {
                return "";
            }
            return this.lastPositionPrefix + filePath;
        },

        getLastCursorPosition: function () {
            var filePath = this.model.get("filePath"),
                lastPosition = window.localStorage.getItem(this.lastPositionKey(filePath));
            
            if (!lastPosition) {
                return {row: 0, column: 0};
            }

            debug("Got last cursor position for this file: " + lastPosition);
            return JSON.parse(lastPosition);
        },

        setLastCursorPosition: _.throttle(function () {
            var cursorPosition = this.aceEditor.getCursorPosition(),
                filePath = this.model.get("filePath"),
                lastPosition;
            try {
                lastPosition = JSON.stringify(cursorPosition);
            } catch (e) {
                debug("Could not serialize current cursor position.", cursorPosition);
                return false;
            }
            debug("Saving last cursor position in file: " + filePath, "\nto: " + lastPosition);
            window.localStorage.setItem(this.lastPositionKey(filePath), lastPosition);
            return true;
        }, 1000),

        setTheme: function (themeName) {
            themeName = themeName || this.defaultTheme;

            debug("Setting theme to: " + themeName);
            this.aceEditor.setTheme("ace/theme/" + themeName);
        },

        initializeAceEditor: function () {
            var _this = this;
            _.defer(function () {
                try {
                    debug("Initializing Ace editor on div: #" + _this.elementId);
                    _this.aceEditor = window.editor = ace.edit(_this.elementId);
                    _this.setTheme();
                    _this.showDefaultScreen();
                    _this.aceEditor.getSession().selection.on("changeCursor", function (e) {
                        if (_this.isCursorChangeHandlerActive) {
                            _this.setLastCursorPosition();
                        }
                    });
                    _this.aceEditor.commands.addCommand({
                        name: "saveFile",
                        bindKey: {win: 'Ctrl-S',  mac: 'Command-S'},
                        exec: function(editor) {
                            _this.saveFile();
                        },
                        readOnly: true // false if this command should not apply in readOnly mode
                    });
                } catch (err) {
                    debug("#" + _this.elementId + " does not exist in the DOM yet.");
                }
            });
        },

        saveFile: function () {
            var _this = this,
                filePath = this.model.get("filePath");
            
            $.post(
                "save?path=" + filePath,
                { data: this.aceEditor.getValue() },
                function (res){
                    if (res.success) {
                        animate.bigGreenTick(_this.$el);
                    } else {
                        debug("Could not save file to disk: " + filePath);
                        animate.bigRedCross(_this.$el);
                    }
                },
                "json"
            );
        },

        showDefaultScreen: function () {
            debug("Showing default screen with help content.");
            this.model.set("filePath", "");
        },

        render: function () {
            if (!this.aceEditor) {
                this.initializeAceEditor();
            }
            return this;
        },

        modes: {
            "js": "javascript"
        },

        fileExtRegExp: /\.[^.]+$/,
        defaultFileExt: "text",
        dummyFilePath: "C:\\Users\\nagarro1\\Desktop\\code\\crood\\public\\css\\main.css",
        defaultTheme: "solarized_light",
        elementId: editorElementId,
        contentAreaCss: null,
        lastPositionPrefix: "lastPosition-",
        helpContent: ""
    });
});