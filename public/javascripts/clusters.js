$(function(){
    var fsize = 16;
    var image_width = 100;
    var image_height = 100;
    var window_width = $(window).width() - 20;
    var window_height = $(window).height() - 20;
    var stroke_color = 'rgba(201, 219, 242, 0.8)';
    var cluster_fill = 'rgba(200, 220, 255, 0.4)';
    var app_fill = 'rgba(232, 251, 255, 0.7)';
    var text_color = 'rgba(120,174,255,1.0)';
    var selected_category;  // selected on hover
    var clicked_category;
    var cluster_apps = {};
    var pad = 5; // padding for boundary circle + app circles
    var px_arr = [];
    var py_arr = [];

    $.getJSON("usage_data.json", function(json) {
        var dataset = parse_data(json);
        console.log(dataset);

        var all_images = [];
        var svg = d3.select("#circles")
            .append("svg")
            .attr("width", window_width)
            .attr("height", window_height);
        var defs = svg.append('defs');
    
    var groups = svg.selectAll("g")
        .data(dataset)
        .enter()
        .append("g")
        .attr("id", function(x, i){
            console.log(x.x);
            // add all the positions first
            px_arr[i] = x.x*window_width;
            py_arr[i] = x.y*window_height;
            return x.id;
        })
        
        .attr("transform", function(x, i) {
            var px = x.x*window_width;
            var py = x.y*window_height;
            var size =  x.r + image_width + pad*2;
            var newpx_arr = px_arr;
            var newpy_arr = py_arr;

            // fix overlap
            // push the circle positions based on all the other ones
            for (var j = 0; j < px_arr.length; j++) {
                if (px != px_arr[j]) {
                    var diff = px - newpx_arr[j];
                    if (Math.abs(diff) < size) {
                        // push x value
                        if (diff < 0) { // then x is smaller, push left
                            newpx_arr[i] = px - size - pad;
                        }
                        else { // x is larger, push right
                            newpx_arr[i] = px + size + pad;
                        }
                    }
                }
            }
            px_arr = newpx_arr;
            for (var j = 0; j < py_arr.length; j++) {
                if (py != py_arr[j]) {
                    var diff = py - newpy_arr[j]
                    if (Math.abs(diff) < size) {
                        // push x value
                        if (diff < 0) { // then x is smaller, push left
                            //console.log("small x");
                            newpy_arr[i] = py - size - pad;
                        }
                        else { // x is larger, push right
                            //console.log("large x");
                            newpy_arr[i] = py + size + pad;
                        }
                    }
                }
            }

            py_arr = newpy_arr;
            var transx = px_arr[i];
            var transy = py_arr[i];

            // cap the circle positions
            if (transx - size < 0) {
                transx -= (transx - size);
            }
            else if (transx + size > window_width) {
                console.log("tx more");
                transx -= (transx - size);
            }
            if (transy - size < 0) {
                console.log("ty less");
                transy -= (transy - size);
            }
            else if (transy + size > window_height) {
                console.log("ty more");
                transy -= (transy - size);
            }

            // put it back in px/py array
            px_arr[i] = transx;
            py_arr[i] = transy;
            console.log(transx + ", " + transy + ": " + i);
            return "translate(" + [transx, transy] + ")";
        })
        .on("mousedown", function(x, i){
            // clicked should only keep everything expanded
            // set a boolean and check in deselect
            // deselect previously clicked one
            deselect_old_cluster(svg, x, clicked_category);
            clicked_category = x.id;
            // TODO: move so focuses in center?
        })
        .on("mouseover", function(x, i){
            if (!selected_category || selected_category != x.id) {
                selected_category = x.id;
                if (!clicked_category || (clicked_category != selected_category)){
                    select_new_cluster(svg, x);
                    create_hidden_circle(svg, x);
                }
            }
        });
    // category circles
    var circles = groups.append("circle")
        .style("stroke", stroke_color)
        .style("fill", cluster_fill)
        .attr("r", function(x){
            return x.r;
        })
        .attr("id", function(x){
            return "circle_" + x.id;
        });

    var label = groups.append("text")
        .text(function(x){
            return x.name;
        })
        .attr("id", function(x){
            return "text_" + x.id;
        })
        .attr({
            "alignment-baseline": "middle",
            "text-anchor": "middle",
            "font-size": fsize,
            "font-family": "Helvetica"
        })
        .style('fill', text_color);
    });

    function select_new_cluster(svg, x){
        var angle = 360/x.apps.length;

        var selected_circle = d3.select("#circle_" + selected_category);
        var selected_text = d3.select("#text_" + selected_category);

        // hidden circle
        /*svg.selectAll("#hidden_" + selected_category)
            .attr("r", function(x){
                return x.r + image_width + pad*2;
            });
        */
        var r = x.r;
        selected_circle.transition()
            .attr("r", function(x){
                console.log("circle size " + x.r + image_width + pad*2);
                return r + image_width + pad*2;
            });
        selected_circle.classed("selected", true);

        // TODO: use if contracting category circle
        //selected_text.transition().attr("font-size", 0);

        selected_text.classed("selected", true);
        
        var category = svg.selectAll("#" + x.id);
        
        // assign the created objects into the corresponding cluster_objects
        cluster_apps[selected_category] = 
            category.selectAll()
                .data(x.apps)
                .enter()
                .append("a")
                .attr("data-category", x.name)
                .attr("xlink:href", function(d, i){
                  return d.url;  
                })
                .classed(x.id, true);

        // append each app
        cluster_apps[selected_category].append("circle")
            .style("stroke", stroke_color)
            .style("fill", cluster_fill)
            .attr("href", "google.com")
            .classed(x.id, true)
            .attr("r", function(d, i){
              return 0;
            })
            .attr("id", function(d, i){
              return d.id;
            })
            .attr("cx", function(d, i){
              var dist = d.r + x.r + pad;
              d.x = Math.cos(angle*i)*dist;
              return d.x;
            })
            .attr("cy", function(d, i){
              var dist = d.r + x.r + pad;
              d.y = Math.sin(angle*i)*dist;
              return d.y;
            })
            .style("fill", app_fill)

            .transition()
            .attr('r', function(d, i){
              return d.r;
            });
        cluster_apps[selected_category]  // append each image
            .append('image')
            .attr('xlink:href', function(d, i){
                console.log("HOOOOOOOOOOOOOOOOOOOOOOO: " + d.img);
                console.log(d);
              return d.img;
            })
            .attr("x", function(d, i){
              return d.x - image_width/2;
            })
            .attr("y", function(d, i){
              return d.y - image_width/2;
            })
            .classed('image_' + selected_category, true)
            .transition()
            .attr("width", image_width)
            .attr("height", image_height)
            .attr("opacity", 0.6)
            ;
    }

    function create_hidden_circle(svg, x){
        // TODO: use if contracting category circle
        // hidden boundary circles - use if contracting category circle
        var category = svg.selectAll("#" + x.id)
            .append("circle")
            .attr("opacity", 0)
            .attr("r", function(x) {
                return x.r + image_width + pad*2; // increase radius after hover
            })
            .attr("id", function(x){
                return "hidden_" + x.id;
            })
            .on("mouseout", function(x, i){
                // TODO: double check if access after clicking on link
                if (clicked_category != selected_category) {
                    deselect_old_cluster(svg, x, selected_category);
                    selected_category = "";
                }
            });
    }

    function deselect_old_cluster(svg, x, old_category){
        /* CLEAN UP OLD CIRCLES */
        // old_category represents cluster to deselect (either clicked or selected)

        // first deselect the circle
        var old_cluster = typeof old_category === 'undefined' ? svg.selectAll() :
            svg.selectAll("#circle_" + old_category); 
        var selected_obj = old_cluster.classed('selected', false)
            .transition()
            .attr('r', function(d){
                return d.r;
            });

        // TODO: use if contracting category circle
        // then deselect the circle's text
        /*old_cluster = typeof selected_category === 'undefined' ? svg.selectAll() :
            svg.selectAll("#text_" + selected_category); 
        selected_obj = old_cluster.classed('selected', false)
            .transition()
            .attr('font-size', fsize);
        */

        // then deselect the circle's images
        old_cluster = typeof old_category === 'undefined' ? svg.selectAll() :
            svg.selectAll(".image_" + old_category);
        selected_obj = old_cluster.classed('selected', false)
            .transition()
            .attr('width', 0)
            .attr('height', 0);

        // TODO: use if contracting category circle
        // decrease the bound of the hidden circle
        svg.selectAll("#hidden_" + selected_category)
            .attr("r", function(x){
                return 0;
            }).remove(); 
        
        var old_apps = typeof old_category === 'undefined' ? svg.selectAll() 
            : svg.selectAll("." + old_category); 
        old_apps.transition().attr('r', 0).remove();
    }
  
    function parse_data(json){
        console.log(json); // this will show the info it in firebug console
        // grab the categories
        var new_json = {};
        var dataset = [];
        var categories = _.unique(_.pluck(_.values(json), 'category'));

        _.each(categories, function(cat, i){
            new_json[cat] = [];
        });

        // create new json to pass in to constructors
        _.each(json, function(obj){
            new_json[obj.category].push(obj);
        });

        // TEMPORARY WAY TO CREATE UNIQUE ID'S
        var id_index = 0;
        _.each(new_json, function(obj, key, list){
            var new_cluster = new window.Cluster(key, obj);
            new_cluster.id = 'category' + id_index;
            dataset.push(new_cluster);
            id_index += 1;
        });

        return dataset;
    }
});


