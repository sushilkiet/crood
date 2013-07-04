define(function (require, exports, module) {
    "use strict";

    var Backbone = require("backbone");
    
    var EditorView = require("views/editor"),
        FileListView = require("views/file-list");

    var EditorModel = require("models/editor"),
        FileListCollection = require("models/file-list-collection");

    module.exports = Backbone.View.extend({
        el: "body",

        initialize: function () {
            this.editorModel = new EditorModel();
            this.editor = new EditorView({
                model: this.editorModel
            });

            this.fileListCollection = new FileListCollection();
            this.fileList = new FileListView({
                editorModel: this.editorModel,
                collection: this.fileListCollection
            })
        },

        render: function () {
            this.$el.empty()
                .append(this.editor.render().el)
                .append(this.fileList.render().el);
        }
    });
});