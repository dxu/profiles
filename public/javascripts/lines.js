var lines_init = function() {
  var numberOfLines,
      stats = null,
      openArray, renderArray, closeArray,
      startTime, endTime, difference, leftBarTime, rightBarTime,
      lineGraphWidth, lineGraphHeight, lineGraph,
      width_count, height_count, box_size, pad, // this is for when there are tons of apps
      allTheLines, hsl, colorArray, diff, appArray, nameArray,
      minRange, maxRange, interval, boxes, activeArray,
      playTimeline = false, layer, toggle = false,
      frequencies = [];

  $(document).ready(function() {
      //get the JSON file
      $.ajax({
          url: '/apps/user',
          dataType: 'json',

      error: function(err) {
          console.log(err)
          console.log('ERROR')
      },

      success: function(data) {

      stats = data;
      numberOfLines = 0;
      startTime = 1.7976931348623157E+10308;
      endTime = 0;

      //app container
      appArray = [];
      nameArray = [];

      var i = 0;
      for (var key in stats) {
          if (stats.hasOwnProperty(key)) {
              appArray[i] = key;
              nameArray[i] = stats[i].url;
              i++;
          }
      }

      //store colors for each app
      colorArray = [];
      activeArray = [];

      //initiate the variables
      for (var i = 0; i < appArray.length; i++) {
          var index = appArray[i];
          var lengthA = stats[index]['open'].length;
          var startTimeA = stats[index]['open'][0];
          var endTimeA = stats[index]['close'][stats[index]['close'].length - 1];

          numberOfLines = numberOfLines+lengthA;

          if (startTimeA < startTime) {
              startTime = startTimeA;
          }
          if (endTimeA > endTime) {
              endTime = endTimeA;
          }
          colorArray[i] = i * (360 / appArray.length);
          activeArray[i] = true;
      }
      difference = endTime - startTime;

      //line graph dimensions
      lineGraphWidth = WINDOW_WIDTH - 250;
      lineGraphHeight = WINDOW_HEIGHT - 250;
      
      box_size = 25,
      pad = 5;
      // subtract height based on number of apps;
      width_count = Math.floor((lineGraphWidth - pad)/box_size);
      height_count = Math.ceil(appArray.length/width_count);
      
      if (height_count > 1)
        lineGraphHeight = lineGraphHeight - height_count*15; // 15 is arbitrary
      
      lineGraph = d3.select("#D3line").append("svg:svg")
        .attr("width", lineGraphWidth)
        .attr("height", lineGraphHeight);

      setUpAppSelection();

      initSlider();

      initFreqLine();
      }});
  });

function myFunction(x){
  var date = x.attributes.number.value;
  var val = new Date(date*1000);
  //console.log(val.format("dd-m-yy"));
  printTheStats(x.attributes.name.value, "username", $.datepicker.formatDate('MM dd, yy', val), val.toLocaleTimeString());
  show_stats();
}

function myFunction2(x) {
  hide_stats();
}

function createAllTheHovers() {
  var hovers = d3.selectAll("line"); // this should change
  //console.log("hovers = ");
  //console.log(hovers[0]);
  for(var i = 0; i < hovers[0].length; i++){
    currline = hovers[0][i];
    currline.addEventListener("mouseover",function(evt) { myFunction(this); }, false);
    currline.addEventListener("mouseout",function(evt) { myFunction2(this); }, false);
    }

}

  function initFreqLine() {

    var w = lineGraphWidth+22, h = 25;

    $("#timeline_panel").css("width", lineGraphWidth);

    for (var i=minRange; i < maxRange-1; i++) {
        frequencies[i] = 0;
        calcFreq(i);
    }
    var freqMax = Math.max.apply(null, frequencies);

    var graph = d3.select(".frequency-container")
      .append("svg")
      .attr("width", w)
      .attr("height", h);

    var x = d3.scale.linear()
      .domain([0, 100])
      .range([0, w]);

    var y = d3.scale.linear()
      .domain([-freqMax/10, freqMax])
      .range([h, 0]);

    var line = d3.svg.line()
        .x(function(d,i) {
          return x(i);
        })
        .y(function(d) {
          return y(d);
        })

    var data = frequencies;
    graph.append("svg:path")
        .attr("d", line(data))
        .attr("class", "frequency-line");
  }

  function updateFreqLine(data) {
    // TODO
  }

  function initSlider() {
    minRange = 0, maxRange = 100;
    $("#timeline").rangeSlider({
      arrows : false,
      defaultValues : {
        min : maxRange * .00,
        max : maxRange * 1.00
      },
      valueLabels : "hide",
      bounds : {
        min : minRange,
        max : maxRange
      }
    });

    //Set slider label dates to the min and max
    updateSliderDates(
      getDate($("#timeline").rangeSlider("min")),
      getDate($("#timeline").rangeSlider("max")));

    $("#timeline").on("valuesChanging", function(e, data) {
        updateSliderDates(getDate(data.values.min), getDate(data.values.max));
    });

    $("#timeline").on("valuesChanged", function(e, data) {
      calculateRender(
        Math.round(data.values.min),
        Math.round(data.values.max), 0);
        //updateSliderDates(getDate(data.values.min), getDate(data.values.max));
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

    //initial loading of lines
    calculateRender($("#timeline").rangeSlider("min"), $("#timeline").rangeSlider("max"), 1);

    //slight edit to the jQRange html
    $(".ui-rangeSlider-container").prepend("<div class='frequency-container'></div>");
  }

  function updateSliderDates(dateLeft, dateRight) {
    var dl = dateLeft, dr = dateRight;
    $("#timeline_dateLeft").text(
      $.datepicker.formatDate('MM dd, yy', dl));
    $("#timeline_dateRight").text(
      $.datepicker.formatDate('MM dd, yy', dr));
  }

  function removeApp(index, k){
      index = index.replace(' ', '-');
      index = index.replace('.', '-');
      index = index.replace('.', '-');
      $("."+index).remove();
      activeArray[k] = false;
  }

  function addAppBack(k){
    //initial loading of lines
    activeArray[k] = true;
    calculateRender($("#timeline").rangeSlider("min"), $("#timeline").rangeSlider("max"), 1);
  }

 function toggleApps(circ){
    //initial loading of lines
    if(toggle == true){
      circ.setFillRadialGradientColorStops([0, '#C6C9D0', 1, 'white']);
      for(var k = 0; k < activeArray.length; k++){
        activeArray[k] = true;
        this.active = true;
        boxes[k].setOpacity(1.0);
        addAppBack(boxes[k].getId());
        layer.draw();
      }
      calculateRender($("#timeline").rangeSlider("min"), $("#timeline").rangeSlider("max"), 1);
      toggle = false;
    }
    else{
    circ.setFillRadialGradientColorStops([0, 'white', 1, '#C6C9D0']);
      for(var k = 0; k < activeArray.length; k++){
        activeArray[k] = false;
        this.active = false;
        boxes[k].setOpacity(0.3);
        removeApp(boxes[k].getName(), boxes[k].getId());
        layer.draw();
      }
      calculateRender($("#timeline").rangeSlider("min"), $("#timeline").rangeSlider("max"), 1);
      toggle = true;
    }
  }

  //generates the lines for an app : OPTIMIZE
  function generateLines(index) {
      var currentLine, i;

      var string = nameArray[index];
      string = string.replace(' ', '-');
      string = string.replace('.', '-');
      string = string.replace('.', '-');

      for (i = 0; i < renderArray.length; i++) {
          currentLine = lineGraph.append("a")
                                 .attr("xlink:href", "http://www."+nameArray[index])
                                 .append("svg:line")
                                 .attr("x1", renderArray[i])
                                 .attr("y1", 0)
                                 .attr("x2", renderArray[i])
                                 .attr("y2", lineGraphHeight)
                                 .attr("name", nameArray[index])
                                 .attr("class", string)
                                 .attr("number", openArray[i])
                                 .style("stroke-width", 3)
                                 .style("stroke", "hsl("+ colorArray[index] +",50%, 50%)");
          var x = (closeArray[i] - openArray[i])/diff + .5;
          currentLine.style("stroke-opacity", x);
      }
      createAllTheHovers();
  }

  //given the starting and ending slider indices (0<=i<=100)
  //renders the lines for each selected app
  function calculateRender(startValIndex, endValIndex, first) {
    d3.selectAll("line").remove();
    leftBarTime = startTime + (difference*startValIndex)/(100);
    rightBarTime = startTime + (difference*endValIndex)/(100);
    diff = rightBarTime - leftBarTime;

      for(var k = 0; k < appArray.length; k++){
        if(activeArray[k] == true){
          var index = appArray[k];
          openArray = stats[index]['open'];
          closeArray = stats[index]['close'];
          var track = 0;

          renderArray = [];
          for (var i = 0; i < openArray.length; i++) {
            if((openArray[i] > leftBarTime) && (closeArray[i] < rightBarTime)){
              renderArray[track] = ((openArray[i]-leftBarTime)/(diff/lineGraphWidth));
              track++;
            }
          }
          generateLines(k);
        }
      }
    }

  //Gets the date of a certain index on the slider
  function getDate(index) {
    var date = startTime + (difference*index)/(100);
    return new Date(date * 1000);
  }

  //Given an index which is slider_min < index < slider_max
  //Calculates number of active apps at that index
  function calcFreq(index) {
    var start = index;
    var end = index + 1;
    left = startTime + (difference*start)/(100);
    right = startTime + (difference*end)/(100);
    diff = right - left;

    for (var i=0; i < appArray.length; i++) {
      if (activeArray[i]) {
        var app = appArray[i];
        openings = stats[app]['open'];
        closings = stats[app]['close'];

        for (var j=0; j < openings.length; j++) {
          if((openings[j] > left) && (closings[j] < right)){
              frequencies[index] = frequencies[index] + 1;
          }
        }
      }
    }
  }

  function setUpAppSelection(){
    if (width_count > appArray.length + 1)
        width_count = appArray.length + 1;

    var stage = new Kinetic.Stage({
        container: 'container',
        width: box_size*width_count,
        height: box_size*height_count
    });

    layer = new Kinetic.Layer();
    var canvas = layer.getCanvas();
    canvas.element.style.position = "relative";
    //canvas.setAttribute('style', 'position: relative;');

    boxes = [];

    var sources = {};
    for (var j = 0; j < appArray.length; j++) {
        sources[nameArray[j]] = "http://" + nameArray[j] + "/favicon.ico";
    }

    // create images
    loadImages(sources, function(images) {
        var k = 1;
        for (var src in sources) {
        //for (var k = 0; k < appArray.length; k++) {
            // anonymous function to induce scope
            (function() {
                colortrack = colorArray[k];
                var colorset = "hsl(" + colortrack + ",50%, 50%)";
                var newy = Math.floor(k/width_count)*box_size,
                    newx;
                if (k < width_count)
                    newx = k*box_size;
                else
                    newx = (k % width_count)*box_size;

                var img = images[src];
                var box = new Kinetic.Rect({
                    x: newx,
                    y: newy, 
                    width: 20,
                    height: 20,
                    id: appArray[k-1],
                    name: nameArray[k-1],
                    active: true,
                    fillPatternImage: img,
                    fillPatternScale: [20/img.width, 20/img.height]
                });

                boxes[k-1] = box;

                box.on('mousedown', function() {
                    if (this.getOpacity() == 1.0 && this.active == true) {
                        this.active = false;
                        this.setOpacity(0.3);
                        removeApp(this.getName(), this.getId());
                    }
                    else {
                        this.active = true;
                        this.setOpacity(1.0);
                        addAppBack(this.getId());
                    }
                    printApp(this.getName());
                    layer.draw();
                });
                box.on('mouseover', function() {
                    this.setFill(colorset);
                    if(activeArray[this.getId()] == false){
                        this.setOpacity(1.0);
                        activeArray[this.getId()] = true;
                        calculateRender($("#timeline").rangeSlider("min"), $("#timeline").rangeSlider("max"), 1);
                        activeArray[this.getId()] = false;
                        this.active = false;
                    }
                    else{
                        this.active = true;
                    }
                    printApp(this.getName());
                    layer.draw();
                    document.body.style.cursor = 'pointer';
                });
                box.on('mouseout', function() {
                    this.setFill(null);
                    this.setFillPatternImage(img);
                    if(activeArray[this.getId()] == false){
                        this.active = false;
                        this.setOpacity(.3);
                    }
                    else{
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
              ony = Math.floor(k/width_count)*box_size + 10;

              var circle = new Kinetic.Circle({
                  x: 10,
                  y: 10,
                  radius: 10,
                  fillRadialGradientStartPoint: 0,
                  fillRadialGradientStartRadius: 0,
                  fillRadialGradientEndPoint: 0,
                  fillRadialGradientEndRadius: 10,
                  fillRadialGradientColorStops: [0, '#C6C9D0', 1, 'white'],
                  stroke: 'white',
                  name: "Toggle",
                  strokeWidth: 1
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
              if (k+1 < width_count)
                offx = (k+1)*box_size + 10;
              else
                offx = ((k+1) % width_count)*box_size + 10;
              offy = Math.floor(k/width_count)*box_size + 10;

              layer.add(circle);
              //add layer to stage
        stage.add(layer);
    });
  }

  function clearApp(){
    var fieldNameElement = document.getElementById("appname");
    while(fieldNameElement.childNodes.length >= 1) {
      fieldNameElement.removeChild(fieldNameElement.firstChild);
    }
    }

  function printApp(d){
    var fieldNameElement = document.getElementById("appname");
    while(fieldNameElement.childNodes.length >= 1) {
      fieldNameElement.removeChild(fieldNameElement.firstChild);
    }
    fieldNameElement.appendChild(fieldNameElement.ownerDocument.createTextNode(d));
    }

  function printTheStats(s, u, l, t){
    printThatApp(s);
    //printUsername(u);
    printLastVisit(l);
    printLastTime(t);
  }

  function printThatApp(d){
    var f = document.getElementById("thatapp");
    while(f.childNodes.length >= 1) {
      f.removeChild(f.firstChild);
    }
    f.appendChild(f.ownerDocument.createTextNode("URL: "));
    f.appendChild(f.ownerDocument.createTextNode(d));
    }

    function printUsername(d){
    var f = document.getElementById("username");
    while(f.childNodes.length >= 1) {
      f.removeChild(f.firstChild);
    }
    f.appendChild(f.ownerDocument.createTextNode("Username: "));
    f.appendChild(f.ownerDocument.createTextNode(d));
    }

    function printLastVisit(d){
    var f = document.getElementById("lastvisit");
    while(f.childNodes.length >= 1) {
      f.removeChild(f.firstChild);
    }
    f.appendChild(f.ownerDocument.createTextNode("Date: "));
    f.appendChild(f.ownerDocument.createTextNode(d));
    }
    function printLastTime(d){
    var f = document.getElementById("lasttime");
    while(f.childNodes.length >= 1) {
      f.removeChild(f.firstChild);
    }
    f.appendChild(f.ownerDocument.createTextNode("Time: "));
    f.appendChild(f.ownerDocument.createTextNode(d));
    }

  /*
   * ANIMATION CONTROLS
   */
  function stepBackward(stepInterval) {
      var tMin = $("#timeline").rangeSlider("min");
      if (tMin > minRange) {
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
      if (tMax < maxRange) {
          $("#timeline").rangeSlider('scrollRight', stepInterval);
      } else if (tMax === tMin) {
          $("#timeline").rangeSlider("min", minRange);
      } else {
          $("#timeline").rangeSlider("min", tMin + stepInterval*.1);
      }

      updateSliderDates(
        getDate($("#timeline").rangeSlider("min")),
        getDate($("#timeline").rangeSlider("max")));
  }

  function play(obj) {
      playTimeline = !playTimeline;
      if (playTimeline) {
          interval = setInterval(function(){stepForward(1)},10);
          obj.src = "img/controls/controls_pause.gif";
      } else {
          pause(obj);
      }
  }

  function pause(obj) {
      clearInterval(interval);
      obj.src = "img/controls/controls_play.gif";
  }

    function loadImages(sources, callback) {
        var images = {};
        var loadedImages = 0;
        var numImages = 0;
        // get num of sources
        for(var src in sources) {
          numImages++;
        }
        for(var src in sources) {
          images[src] = new Image();
          images[src].onload = function() {
            if(++loadedImages >= numImages) {
              callback(images);
            }
          };
          var img = images[src];
          img.src = sources[src];

          //img.onerror = function (evt) {this.onerror=null;}
          img.onerror = function (evt){console.log('in here');this.onerror=null; this.src='/img/app_icons/favicon-default.gif';};
        console.log('hihihi');
          
        }
    } 
};
