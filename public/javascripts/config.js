var VIS_COUNT = 4;

var APP_DATA = [],
    CAT_DATA = {},
    COLORS = [],
    WINDOW_WIDTH = $(window).width(),
    WINDOW_HEIGHT = $(window).height(),
    app = {
        models: {},
        collections: {},
        views: {},
        templates: {},
        util: {
          vis: {}
        }
    };

/*
 * durations constants
 */
var X_LINE_OFFSET = 0,
    ROW_HEIGHT = 0,
    CANVAS_WIDTH = 0,
    ICON_WIDTH = 20,
    ICON_HEIGHT = 20,
    DURATIONS_Y_SPACING = 10, // same as in definitions.scss
    STROKE_WIDTH = ICON_HEIGHT,
    ANIMATE_TIME = 300; // add more as necessary

show_stats = function(id) {
    $("#stats").show();
};

hide_stats = function() {
    $("#stats").hide();
};

$(document).mousemove(function(e) {
    $("#stats").css({
        position: "absolute",
        top: e.pageY+10,
        left: e.pageX+10
    });
});

// get data
$(function() {
    //get the JSON file
    $.ajax({
      url: 'apps/userallowed',
      dataType: 'json',
      error: function(err) {
        console.log(err);
      },
      success: function(data) {
        APP_DATA = data;
        // format the data for categories
        var cats = _.uniq(_.pluck(data.apps, 'category'));

        _.each(cats, function(cat) {
         CAT_DATA[cat] = _.where(data.apps, {category: cat});
        });

        var color_num = 0,
            app_length = APP_DATA.apps.length;

        for (var i = 0; i < app_length; i++) {
            color_num = i * (360 / app_length);
            COLORS[i] = "hsl(" + color_num + ",50%, 50%)";
        }

        init();

      }
    });
});

var init = function() {
    clusters_init();
    lines_init();
    grid_init();
    app.util.vis.durations_init(); // uncomment when function is implemented
};
