/*
 * PLEASE LOOK IN CONFIG FILE FOR CONSTANTS FOR OFFSETS
 */

(function() {
var apps_durations;
// mapping of apps to their total
var canvas, canvas_ctx, canvas_height,
    line_colors,
    start_time, end_time, total_time,
    duration_width = WINDOW_WIDTH, // not used
    duration_height = WINDOW_HEIGHT,
    duration_line_width, duration_y_spacing,
    animate_time,
    min_render_time, max_render_time,
    freq;
var ordered_apps;

// html5 animation
window.requestAnimFrame = (function(){
    return window.requestAnimationFrame       ||
           window.webkitRequestAnimationFrame ||
           window.mozRequestAnimationFrame    ||
    function( callback ){
        window.setTimeout(callback, 1000 / 60);
    };
})();

function my_animate(num_frames, num_frames_remain, increment) {
    var line_width_change = ICON_HEIGHT * (3/4),
        y_space_change = DURATIONS_Y_SPACING * (3/4);

    duration_line_width += increment * line_width_change/num_frames;
    duration_y_spacing += increment * y_space_change/num_frames;

    canvas_ctx.clearRect(0, 0, canvas.width, canvas.height);
    render_all_apps_from_json(APP_DATA);

    requestAnimFrame(function() {
        if (num_frames_remain > 0) {
            my_animate(num_frames, num_frames_remain - 1, increment);
        }
    });
}

/*
 * Action events
 */
$(document).ready(function() {
    $("#durations-compress").click(function() {
        if ($(this).hasClass("durations-compressed")) {
            my_animate(animate_time, animate_time, 1);

            $(this).removeClass("durations-compressed")
                   .addClass("durations-expanded")
                   .attr("src", "img/ui_icons/up.png");

            $("#durations-sidebar")
            .css('visibility', 'visible')
            .animate({
                opacity: 1.0,
                height: APP_DATA.apps.length * (ICON_HEIGHT + DURATIONS_Y_SPACING)
            }, ANIMATE_TIME);
            canvas.height = APP_DATA.apps.length * (ICON_HEIGHT + DURATIONS_Y_SPACING); // subtract size of menubar
        } else {
            my_animate(animate_time, animate_time, -1);

            $(this).removeClass("durations-expanded")
                   .addClass("durations-compressed")
                   .attr("src", "img/ui_icons/down.png");
            $("#durations-sidebar").animate({
                opacity: 0.0,
                height: (1/4) * APP_DATA.apps.length * (ICON_HEIGHT + DURATIONS_Y_SPACING)
            }, ANIMATE_TIME, function() {
                $(this).css('visibility', 'hidden');
            });
            canvas.height = (1/4) * APP_DATA.apps.length * (ICON_HEIGHT + DURATIONS_Y_SPACING); // subtract size of menubar
        }
    });

    $("#durations-slider").on("valuesChanged", function(e, data) {
        var percent_of_range_min, percent_of_range_max, range,
            offset_min, offset_max;
        range = end_time - start_time;
        percent_of_range_min = data.values.min/100.0;
        percent_of_range_max = data.values.max/100.0;
        offset_min = range * percent_of_range_min;
        offset_max = range * percent_of_range_max;

        min_render_time = start_time + offset_min;
        max_render_time = start_time + offset_max;

        total_time = max_render_time - min_render_time;

        canvas_ctx.clearRect(0, 0, canvas.width, canvas.height);
        render_all_apps_from_json(APP_DATA);
    });

    //hacky adjust heiight
    $("#durations-wrapper").height(WINDOW_HEIGHT - 180);
});

/*
 * main setup function for durations
 * called inside config.js
 */
app.util.vis.durations_init = function() {
    initialize();
    //render_all_apps_from_json(sample_data);
    render_all_apps_from_json(APP_DATA);

    init_durations_slider();
    init_durations_freq(freq);
};

/*
 * internal setup function. Sets up canvas
 */
function initialize() {
    $("#durations").width(duration_width);
    canvas = document.getElementById('durations-canvas');
    //canvas.height = duration_height; // subtract size of menubar
    //canvas.height = WINDOW_HEIGHT - 250; // subtract size of menubar
    canvas.height = APP_DATA.apps.length * (ICON_HEIGHT + DURATIONS_Y_SPACING); // subtract size of menubar
    canvas.width = 930; // 10 margin
    canvas_ctx = canvas.getContext('2d');

    duration_line_width = ICON_HEIGHT;
    duration_y_spacing = DURATIONS_Y_SPACING;
    animate_time = 10.0;

    start_time = startTime; // change to startTime, endTime
    end_time = endTime;
    min_render_time = start_time;
    max_render_time = end_time;
    total_time = max_render_time - min_render_time;

    // generate colors
    line_colors = generate_colors(APP_DATA.apps.length);

    // init freq array
    freq = [];
    for (var i = 0; i <= 100; i += 1) {
        freq[i] = 0;
    }
    freq[101] = -1; // flag for first render
                    // if this is -1, then it is the first render
                    // if it is 0, then it is a re-render
}

/*
 * order apps by duration
 * Input: All JSON Data
 * Output: Array sorted in order of most used to least used
 */
function order_apps(json) {
  var d_json = _.map(json, sum_duration_per_app);
  var n = _.sortBy(d_json, function(app) {
      return -app.durations || 0;
  });
  return n;
}

/*
 * Sums the total duration of an app
 * Input: JSON Data for one app
 * Output: Duration of the app, array of duration times
 */
function sum_duration_per_app(app) {
    if (app.focus === undefined || app.unfocus === undefined) {
        console.log("Failed to get focus data for:");
        console.log(app);
        return 0;
    }
    var sum_dur = 0;
    for(index in app.focus) {
      if(app.unfocus[index])
        sum_dur += app.unfocus[index] - app.focus[index];
    }
    // app.durations = _.reduce(_.zip(app.focus, app.unfocus), function(memo, pair) {
    //     return memo + pair[1] - pair[0];
    // }, 0);
    app.durations = sum_dur

    return app;
}

/*
 * Calculates the frequency array for the slider line
 * Called in render_app_segment
 */
function add_to_frequencies(focus_time) {
    var freq_index;

    freq_index = Math.floor(((focus_time - start_time)/(end_time - start_time)) * 100);
    freq[freq_index] += 1;
}

/*
 * Renders the icon for one app
 * Input: App Id
 * Output: Draws to canvas in correct location
 *         x: 0
 *         y: app_ranking * height_per_row
 */
function render_icon(item) {
    var img_copy = item.url;
    var parts = img_copy.split(".");
    img_copy = parts[0];

    // need to consider apps with no images

    $("#durations-sidebar").append('<a href="http://' + item.url + '"><img class="durations-icon" src="img/app_icons/' + img_copy + '-square.png" onError="this.src = \'img/app_icons/social-networks-square.png\'"/></a>');
}

/*
 * Renders the icon for one app
 * Input: y_position, focus_time, unfocus_time
 * Output: Draws only one line segment of an app
 */
function render_app_segment(y, focus_time, unfocus_time) {
    if (focus_time < min_render_time) { // clip min time
        focus_time = min_render_time;
    }

    if (unfocus_time > max_render_time) { // clip max time
        unfocus_time = max_render_time;
    }

    /*
    var start_x = (focus_time - start_time) / total_time * canvas.width,
        end_x = (unfocus_time - start_time) / total_time * canvas.width;
    */
    var start_x = (focus_time - min_render_time) / total_time * canvas.width,
        end_x = (unfocus_time - min_render_time) / total_time * canvas.width;


    canvas_ctx.beginPath();
    canvas_ctx.moveTo(start_x, y);
    canvas_ctx.lineTo(end_x, y);
    canvas_ctx.stroke();
    canvas_ctx.closePath();

    // add to frequencies array
    if (freq[101] === -1) {
        add_to_frequencies(focus_time);
    }
}

/* Renders all the line segments for app
 * Input: the json data
 * Output: Draws all the line segments of an app, as well as its icon
 */
function render_app(item, index) {
    var y_by_rank = index * (duration_line_width + duration_y_spacing) + STROKE_WIDTH/2;
    //var focus_pairs = _.zip(item.open, item.close);
    if (item.focus === undefined || item.unfocus === undefined) {
        console.log("focus or unfocus time missing");
    }

    //canvas_ctx.beginPath();
    canvas_ctx.lineWidth = duration_line_width;
    canvas_ctx.strokeStyle = COLORS[index];

    var focus_pairs = _.zip(item.focus, item.unfocus);
    _.each(focus_pairs, function(pair) {
        if (pair[0] !== undefined && pair[1] !== undefined) {
            render_app_segment(y_by_rank, pair[0], pair[1]);
        }
    });
    //canvas_ctx.closePath();

    render_icon(item);
}

/* Render all lines for all apps
 * Input: All JSON Data
 * Output: Draws paints entire canvas
 */
function render_all_apps_from_json(data) {
    $("#durations-sidebar").html('');
    var ready = data.apps;
    // ready = _.filter(data.apps, function(item) {
    //   return item.focus && item.unfocus && item.focus.length == item.unfocus.length;
    // });
    ordered_apps = order_apps(ready);

    console.log('should be ordered')
    console.log(ready)
    // is underscore async?
    for (var index in ordered_apps) {
        render_app(ordered_apps[index], index);
    }
    freq[101] = 0; // set flag that we've already rendered once
}

/*
 * Generates random colors in hex for each value in the colored matrix
 */
function generate_colors(num_apps)
{
    var i, j, max_index,    // iteration vars and bound on byte choices
        hex, colors;        // color byte choices, map from value to hex

    hex = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
           'A', 'B', 'C', 'D', 'E', 'F'];
    max_index = hex.length - 1;

    colors = [];
    //colors[0] = '#FFFFFF'; // set blank color
    for (i = 0; i < num_apps; ++i) {
        colors[i] = "#";
        for (j = 0; j < 6; ++j) {
            colors[i] += hex[Math.round(Math.random()*max_index)];
        }
    }
    return colors;
}


})();
