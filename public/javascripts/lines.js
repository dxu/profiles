// globals so others can use
var startTime,
    endTime,
    lines_minRange,
    lines_maxRange,
    frequencies = [],
    frequency_line,
    MS_IN_DAY = 86400000,               // milliseconds in a day
    MS_IN_WEEK = 604800000,             // milliseconds in a week 
    MS_IN_MONTH = 26297000000000,
    playTimeline = false,
    lines_appArray,
    lines_activeArray,
    lineGraphWidth,
    lines_stats=null,
    lines_difference,
    lines_diff;

var lines_init = function() {  
var numberOfLines, openArray, renderArray, closeArray, 
    leftBarTime, rightBarTime, 
    lineGraphHeight, lineGraph, width_count, height_count, box_size,
    pad, // this is for when there are tons of apps
    allTheLines, hsl, colorArray, nameArray, 
    interval, boxes, 
    layer, toggle = false;

    $(document).ready(function() {
        var data = APP_DATA.apps;
        lines_stats = data;
        numberOfLines = 0;
        startTime = 1.7976931348623157E+10308;
        endTime = 0;

        //app container
        lines_appArray = [];
        nameArray = [];

        var i = 0;
        for (var key in lines_stats) {
            if (lines_stats.hasOwnProperty(key)) {
                lines_appArray[i] = key;
                nameArray[i] = lines_stats[i].url;
                i++;
            }
        }

        //store colors for each app
        colorArray = [];
        lines_activeArray = [];

        //initiate the variables
        for (var i = 0; i < lines_appArray.length; i++) {
            var index = lines_appArray[i];
            var lengthA = lines_stats[index]['open'].length;
            var startTimeA = lines_stats[index]['open'][0];
            var endTimeA = 
                lines_stats[index]['close'][lines_stats[index]['close'].length - 1];

            numberOfLines = numberOfLines + lengthA;

            if (startTimeA < startTime) {
                startTime = startTimeA;
            }
            if (endTimeA > endTime) {
                endTime = endTimeA;
            }
            colorArray[i] = i * (360 / lines_appArray.length);
            lines_activeArray[i] = true;
        }
        lines_difference = endTime - startTime;

        //line graph dimensions
        lineGraphWidth = WINDOW_WIDTH - 250;
        lineGraphHeight = WINDOW_HEIGHT - 250;

        box_size = 25, pad = 5;

        // subtract height based on number of apps;
        width_count = Math.floor((lineGraphWidth - pad) / box_size);
        height_count = Math.ceil(lines_appArray.length / width_count);

        if (height_count > 1)
            lineGraphHeight = lineGraphHeight - height_count * 15;
        // 15 is arbitrary

        lineGraph = d3.select("#D3line")
          .append("svg:svg")
          .attr("width", lineGraphWidth)
          .attr("height", lineGraphHeight);

        findMostUsedApp();

        setUpAppSelection();

        initSlider();
        initFreqLine();
        initViewControls();

        $("#timeline").on("valuesChanged", function(e, data) {
            calculateRender(
                Math.round(data.values.min), 
                Math.round(data.values.max), 0);
            //updateSliderDates(getDate(data.values.min), 
                //getDate(data.values.max));
        });

        //initial loading of lines
        calculateRender(
            $("#timeline").rangeSlider("min"), 
            $("#timeline").rangeSlider("max"), 1);

        $('#container-toggle').click(function() {
            if (!$(this).hasClass("menu-button-active")) { // NOT active
                $('#container-toggle')[0].src = "img/ui_icons/up.png";
                $("#container").stop().animate({
                    top: $("#container").height() - 23 // fix
                }, 300);
                $("#appname").stop().animate({
                    top: $("#container").height() - 23
                }, 300);
                // update the height of the lines
                lineGraphHeight -= 60;
                lineGraph
                    .transition()
                    .attr("height", lineGraphHeight);
                calculateRender($("#timeline").rangeSlider("min"),
                    $("#timeline").rangeSlider("max"), 1);
                $("#container").css("position", "relative");
                $("#appname").css("display", "block");
            } else { // active already
                // update the height of the lines
                $('#container-toggle')[0].src = "img/ui_icons/down.png";
                lineGraphHeight += 60;
                lineGraph
                    .transition()
                    .attr("height", lineGraphHeight);
                // need to rerender (otherwise won't work if you hover over the apps)
                calculateRender($("#timeline").rangeSlider("min"),
                    $("#timeline").rangeSlider("max"), 1);
                $("#container").stop().animate({
                    top: $("#header").height() - $("#container").height() - 85
                }, 300);
                $("#appname").stop().animate({
                    top: $("#header").height() - $("#container").height() - 85
                }, 300);
                $("#container").css("position", "absolute");
                setTimeout( function(){ $("#appname").css("display", "none"); }, 200 );
            }
        }); 
    });

    /*************************************************************************
     * Line Generation
     */
    //generates the lines for an app : OPTIMIZE
    function generateLines(index) {
        var currentLine, i;

        var string = nameArray[index];
        string = string.replace(' ', '-');
        string = string.replace('.', '-');
        string = string.replace('.', '-');

        for ( i = 0; i < renderArray.length; i++) {
            currentLine = lineGraph.append("a")
                .attr("xlink:href", "http://www." + nameArray[index])
                .append("svg:line").attr("x1", renderArray[i])
                .attr("y1", 0).attr("x2", renderArray[i])
                .attr("y2", lineGraphHeight)
                .attr("name", nameArray[index])
                .attr("class", string)
                .attr("number", openArray[i])
                .style("stroke-width", 3)
                .style("stroke", COLORS[index]);//"hsl(" + colorArray[index] + ",50%, 50%)");

            var x = (closeArray[i] - openArray[i]) / lines_diff+ .5;
            currentLine.style("stroke-opacity", x);
        }
        createAllTheHovers();
    }

    //given the starting and ending slider indices (0<=i<=100)
    //renders the lines for each selected app
    function calculateRender(startValIndex, endValIndex, first) {
        d3.selectAll("line").remove();
        leftBarTime = startTime + (lines_difference * startValIndex) / (100);
        rightBarTime = startTime + (lines_difference * endValIndex) / (100);
        lines_diff= rightBarTime - leftBarTime;

        for (var k = 0; k < lines_appArray.length; k++) {
            if (lines_activeArray[k] == true) {
                var index = lines_appArray[k];
                openArray = lines_stats[index]['open'];
                closeArray = lines_stats[index]['close'];
                var track = 0;

                renderArray = [];
                for (var i = 0; i < openArray.length; i++) {
                    if ((openArray[i] > leftBarTime) && (closeArray[i] < rightBarTime)) {
                        renderArray[track] = ((openArray[i] - leftBarTime) / (lines_diff/ lineGraphWidth));
                        track++;
                    }
                }
                generateLines(k);
            }
        }
    }

    /*************************************************************************
     * Selection
     */
    function removeApp(index, k) {
        index = index.replace(' ', '-');
        index = index.replace('.', '-');
        index = index.replace('.', '-');
        $("." + index).remove();
        lines_activeArray[k] = false;
    }

    function addAppBack(k) {
        //initial loading of lines
        lines_activeArray[k] = true;
        calculateRender($("#timeline").rangeSlider("min"), $("#timeline").rangeSlider("max"), 1);
    }

    function toggleApps(circ) {
        //initial loading of lines
        if (toggle == true) {
            circ.setFill('black');
            for (var k = 0; k < lines_activeArray.length; k++) {
                lines_activeArray[k] = true;
                this.active = true;
                boxes[k].setOpacity(1.0);
                addAppBack(boxes[k].getId());
                layer.draw();
            }
            calculateRender($("#timeline").rangeSlider("min"), $("#timeline").rangeSlider("max"), 1);
            toggle = false;
        } else {
            circ.setFill('');
            circ.setStroke('black');
            for (var k = 0; k < lines_activeArray.length; k++) {
                lines_activeArray[k] = false;
                this.active = false;
                boxes[k].setOpacity(0.3);
                removeApp(boxes[k].getName(), boxes[k].getId());
                layer.draw();
            }
            calculateRender($("#timeline").rangeSlider("min"), $("#timeline").rangeSlider("max"), 1);
            toggle = true;
        }
        updateFrequencies();
        tweenPath();
    }

    function findMostUsedApp() {
        var longest = lines_stats[0].open.length;
        var mostUsed = lines_stats[0].url;

        for (var i = 0; i < lines_stats.length; i++) {
            var length = lines_stats[i].open.length;
            if (length > longest) {
                longest = length;
                mostUsed = lines_stats[i].url;
            }
        }

        for (var i = 0; i < lines_stats.length; i++) {
            if (lines_stats[i].url != mostUsed) {
                lines_activeArray[i] = false;
            }
        }       
    }

    function loadImages(sources, callback) {
        var images = {};
        var loadedImages = 0;
        var numImages = 0;
        // get num of sources
        for (var src in sources) {
            numImages++;
        }
        for (var src in sources) {
            images[src] = new Image();
            images[src].onload = function() {
                if (++loadedImages >= numImages) {
                    callback(images);
                }
            };
            var img = images[src];
            img.src = sources[src];

            img.onerror = function(evt) {
                this.onerror = null;
                this.src = 'img/app_icons/social-networks-square.png';
            };
        }
    }

    function setUpAppSelection() {
        if (width_count > lines_appArray.length + 1)
            width_count = lines_appArray.length + 1;

        var stage = new Kinetic.Stage({
            container : 'container',
            width : box_size * width_count,
            height : box_size * height_count
        });

        layer = new Kinetic.Layer();
        var canvas = layer.getCanvas();
        canvas.element.style.position = "relative";
        //canvas.setAttribute('style', 'position: relative;');

        boxes = [];

        var sources = {};

        for (var j = 0; j < lines_appArray.length; j++) {
            var img_name = nameArray[j].split(".")[0];
            sources[nameArray[j]] = "img/app_icons/" + img_name + "-square.png";
        }

        // create images
        loadImages(sources, function(images) {
            var k = 1;
            for (var src in sources) {
                //for (var k = 0; k < lines_appArray.length; k++) {
                // anonymous function to induce scope
                (function() {
                    colortrack = colorArray[k];
                    var colorset = "hsl(" + colortrack + ",50%, 50%)";
                    var newy = Math.floor(k / width_count) * box_size, newx;
                    if (k < width_count)
                        newx = k * box_size;
                    else
                        newx = (k % width_count) * box_size;

                    var img = images[src];
                    var isActive = lines_activeArray[k - 1];
                    var opac = 1.0;
                    if(isActive == false){
                        opac = 0.3;
                    }

                    var box = new Kinetic.Rect({
                        x : newx,
                        y : newy,
                        width : 20,
                        height : 20,
                        id : lines_appArray[k - 1],
                        name : nameArray[k - 1],
                        colorHover: colorArray[k - 1],
                        active : true,
                        opacity : opac,
                        fillPatternImage : img,
                        fillPatternScale : [20 / img.width, 20 / img.height]
                    });

                    boxes[k - 1] = box;

                    box.on('mousedown', function() {
                        if (this.getOpacity() == 1.0 && this.active == true) {
                            this.active = false;
                            this.setOpacity(0.3);
                            removeApp(this.getName(), this.getId());
                        } else {
                            this.active = true;
                            this.setOpacity(1.0);
                            addAppBack(this.getId());
                        }
                        printApp(this.getName());
                        layer.draw();

                        updateFrequencies();
                        tweenPath();
                    });
                    box.on('mouseover', function() {
                        this.setFill("hsl(" + this.attrs.colorHover + ",50%, 50%)");
                        if (lines_activeArray[this.getId()] == false) {
                            this.setOpacity(1.0);
                            lines_activeArray[this.getId()] = true;
                            calculateRender($("#timeline").rangeSlider("min"), $("#timeline").rangeSlider("max"), 1);
                            lines_activeArray[this.getId()] = false;
                            this.active = false;
                        } else {
                            this.active = true;
                        }
                        printApp(this.getName());
                        layer.draw();
                        document.body.style.cursor = 'pointer';
                    });
                    box.on('mouseout', function() {
                        this.setFill(null);
                        this.setFillPatternImage(img);
                        if (lines_activeArray[this.getId()] == false) {
                            this.active = false;
                            this.setOpacity(.3);
                        } else {
                            this.active = true;
                        }
                        clearApp();
                        calculateRender($("#timeline").rangeSlider("min"), $("#timeline").rangeSlider("max"), 1);
                        layer.draw();
                        document.body.style.cursor = 'default';
                    });
                    layer.add(box);

                })();
                k++;
            }
            // this depends on where the row is
            var onx, ony;
            k = 0;
            /*              if (k < width_count)
             onx = k*box_size + 10;
             else
             onx = (k % width_count)*box_size + 10; */
            ony = Math.floor(k / width_count) * box_size + 10;

            var circle = new Kinetic.Circle({
                x : 10,
                y : 10,
                radius : 9,
                fill: 'black',
                stroke : 'white',
                name : "Toggle",
                strokeWidth : 1
            });

            circle.on('mousedown', function() {
                toggleApps(this);
                printApp(this.getName());
                layer.draw();
            });

            circle.on('mouseover', function() {
                printApp(this.getName());
                layer.draw();
            });

            circle.on('mouseout', function() {
                clearApp();
                layer.draw();
            });

            var offx, offy;
            if (k + 1 < width_count)
                offx = (k + 1) * box_size + 10;
            else
                offx = ((k + 1) % width_count) * box_size + 10;
            offy = Math.floor(k / width_count) * box_size + 10;

            layer.add(circle);
            //add layer to stage
            stage.add(layer);
        });
    }

    /*************************************************************************
     * User Feedback
     */
    function myFunction(x) {
        var date = x.attributes.number.value;
        var val = new Date(date * 1000);
        //console.log(val.format("dd-m-yy"));
        printThelines_stats(x.attributes.name.value, "username", $.datepicker.formatDate('MM dd, yy', val), val.toLocaleTimeString());
        show_stats();
    }

    function myFunction2(x) {
        hide_stats();
    }

    function createAllTheHovers() {
        var hovers = d3.selectAll("line");
        // this should change
        //console.log("hovers = ");
        //console.log(hovers[0]);
        for (var i = 0; i < hovers[0].length; i++) {
            currline = hovers[0][i];
            currline.addEventListener("mouseover", function(evt) {
                myFunction(this);
                document.body.style.cursor = 'pointer';
            }, false);
            currline.addEventListener("mouseout", function(evt) {
                myFunction2(this);
                document.body.style.cursor = 'default';
            }, false);
        }
    }

    function clearApp() {
        var fieldNameElement = document.getElementById("appname");
        while (fieldNameElement.childNodes.length >= 1) {
            fieldNameElement.removeChild(fieldNameElement.firstChild);
        }
    }

    function printApp(d) {
        var fieldNameElement = document.getElementById("appname");
        while (fieldNameElement.childNodes.length >= 1) {
            fieldNameElement.removeChild(fieldNameElement.firstChild);
        }
        fieldNameElement.appendChild(fieldNameElement.ownerDocument.createTextNode(d));
    }

    function printThelines_stats(s, u, l, t) {
        printThatApp(s);
        //printUsername(u);
        printLastVisit(l);
        printLastTime(t);
    }

    function printThatApp(d) {
        var f = document.getElementById("thatapp");
        while (f.childNodes.length >= 1) {
            f.removeChild(f.firstChild);
        }
        f.appendChild(f.ownerDocument.createTextNode("URL: "));
        f.appendChild(f.ownerDocument.createTextNode(d));
    }

    function printUsername(d) {
        var f = document.getElementById("username");
        while (f.childNodes.length >= 1) {
            f.removeChild(f.firstChild);
        }
        f.appendChild(f.ownerDocument.createTextNode("Username: "));
        f.appendChild(f.ownerDocument.createTextNode(d));
    }

    function printLastVisit(d) {
        var f = document.getElementById("lastvisit");
        while (f.childNodes.length >= 1) {
            f.removeChild(f.firstChild);
        }
        f.appendChild(f.ownerDocument.createTextNode("Date: "));
        f.appendChild(f.ownerDocument.createTextNode(d));
    }

    function printLastTime(d) {
        var f = document.getElementById("lasttime");
        while (f.childNodes.length >= 1) {
            f.removeChild(f.firstChild);
        }
        f.appendChild(f.ownerDocument.createTextNode("Time: "));
        f.appendChild(f.ownerDocument.createTextNode(d));
    } 
};
