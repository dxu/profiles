/*************************************************************************
 * Timeline
 */

function tweenPath() {
var w = lineGraphWidth + 22, 
    h = 25,

    freqMax = Math.max.apply(null, frequencies),

    x = d3.scale.linear()
            .domain([0, 100])
            .range([0, w]),

    y = d3.scale.linear()
            .domain([-freqMax / 10, freqMax])
            .range([h, 0]);

    line = d3.svg.line()
            .x(function(d, i) {
              return x(i);
            })
            .y(function(d) {
              return y(d);
            });

    d3.selectAll("path")
        .data([frequencies])
        .transition()
        .duration(500)
        .attr("d", line);
}

function updateFrequencies () {
    for (var i = lines_minRange; i < lines_maxRange - 1; i++) {
        frequencies[i] = 0;
        calcFreq(i);
    }
    console.log(lines_appArray)
    console.log(lines_stats)
    console.log(lines_activeArray)
}

//Given an index which is slider_min < index < slider_max
//Calculates number of active apps at that index
function calcFreq(index) {
    var start = index;
    var end = index + 1;
    var left = startTime + (lines_difference * start) / (100);
    var right = startTime + (lines_difference * end) / (100);
    lines_diff= right - left;
    for (var i = 0; i < lines_appArray.length; i++) {
        if (lines_activeArray && lines_activeArray[i]) {
            var app = lines_appArray[i];
            openings = lines_stats[app]['open'];
            closings = lines_stats[app]['close'];

            for (var j = 0; j < openings.length; j++) {
                if ((openings[j] > left) && (closings[j] < right)) {
                    frequencies[index] = frequencies[index] + 1;
                }
            }
        }
    }
}

function initFreqLine() {
    updateFrequencies();
    $("#timeline_panel").css("width", lineGraphWidth);

var w = lineGraphWidth + 22, 
    h = 25,

    freqMax = Math.max.apply(null, frequencies),

    x = d3.scale.linear()
            .domain([0, 100])
            .range([0, w]),

    y = d3.scale.linear()
            .domain([-freqMax / 10, freqMax])
            .range([h, 0]),

    line = d3.svg.line()
            .x(function(d, i) {
              return x(i);
            })
            .y(function(d) {
              return y(d);
            });

var graph = d3.select(".frequency-container")
            .append("svg")
            .attr("width", w)
            .attr("height", h);

    graph.append("svg:path")
        .attr("d", line(frequencies))
        .attr("class", "frequency-line");
}

function initSlider() {
    lines_minRange = 0, 
    lines_maxRange = 100;

    $("#timeline").rangeSlider({
        arrows : false,
        defaultValues : {
            min : lines_maxRange * .00,
            max : lines_maxRange * 1.00
        },
        valueLabels : "hide",
        bounds : {
            min : lines_minRange,
            max : lines_maxRange
        }
    });

    //Set slider label dates to the min and max
    updateSliderDates(
        getDate($("#timeline").rangeSlider("min")), 
        getDate($("#timeline").rangeSlider("max")));

    $("#timeline").on("valuesChanging", function(e, data) {
        updateSliderDates(
            getDate(data.values.min), 
            getDate(data.values.max));
    });

    $("#timeline_play_pause").click(function() {
        play(this);
    });

    $("#timeline_step_back").click(function() {
        stepBackward(10);
    });

    $("#timeline_step_forward").click(function() {
        stepForward(10);
    });

    //slight edit to the jQRange html
    $(".ui-rangeSlider-container")
        .prepend("<div class='frequency-container'></div>");
}

function initViewControls() {
    $('#timeline_day_view').click(function () {
        viewActivity('DAY');
    });

    $('#timeline_week_view').click(function () {
        viewActivity('WEEK');
    });

    $('#timeline_month_view').click(function () {
        viewActivity('MONTH');
    });
}

function updateSliderDates(dateLeft, dateRight) {
    var dl = dateLeft, dr = dateRight;
    $("#timeline_dateLeft")
        .text($.datepicker.formatDate('MM dd, yy', dl));
    $("#timeline_dateRight")
        .text($.datepicker.formatDate('MM dd, yy', dr));
}

//Gets the date of a certain index on the slider
function getDate(index) {
    var date = startTime + ((endTime - startTime) * index) / (100);
    return new Date(date * 1000);
}

/*
 * Date Selector: view activity in the past day, week, or month
 * 
 */
function viewActivity(time_range) {
var ms,     //milliseconds
    result;
    switch (time_range) {
        case 'DAY': 
            ms = MS_IN_DAY;   
            break;
        case 'WEEK':
            ms = MS_IN_WEEK;
            break;
        case 'MONTH': 
            ms = MS_IN_MONTH;
            break;
        default:
            ms = MS_IN_DAY;
            break;
    }
    result = Math.floor(100-((1/((endTime-startTime) / (ms/1000)))*100));
    result = result >= 0 ? result : 0;
    $("#timeline").rangeSlider("max", 100);
    $("#timeline").rangeSlider("min", result);
    updateSliderDates(getDate(result), getDate(100));
}

/*
 * Animation Controls
 */
function stepBackward(stepInterval) {
    var tMin = $("#timeline").rangeSlider("min");
    if (tMin > lines_minRange) {
        $("#timeline").rangeSlider('scrollLeft', stepInterval);
    } else {
        var tMax = $("#timeline").rangeSlider("max");
        $("#timeline").rangeSlider("max", tMax - stepInterval);
    }

    updateSliderDates(
        getDate($("#timeline").rangeSlider("min")), 
        getDate($("#timeline").rangeSlider("max")));
}

function stepForward(stepInterval) {
    var tMax = $("#timeline").rangeSlider("max");
    var tMin = $("#timeline").rangeSlider("min");
    if (tMax < lines_maxRange) {
        $("#timeline").rangeSlider('scrollRight', stepInterval);
    } else if (tMax === tMin) {
        $("#timeline").rangeSlider("min", lines_minRange);
    } else {
        $("#timeline").rangeSlider("min", tMin + stepInterval * .1);
    }

    updateSliderDates(
        getDate($("#timeline").rangeSlider("min")), 
        getDate($("#timeline").rangeSlider("max")));
}

function play(obj) {
    playTimeline = !playTimeline;
    if (playTimeline) {
        interval = setInterval(function() {
            stepForward(1)
        }, 10);
        obj.src = "img/controls/controls_pause.gif";
    } else {
        pause(obj);
    }
}

function pause(obj) {
    clearInterval(interval);
    obj.src = "img/controls/controls_play.gif";
}