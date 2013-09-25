clusters_init = function(){
    var window_width = WINDOW_WIDTH - 30,
        window_height = WINDOW_HEIGHT - 50, // TODO: subtract size of menubar
        selected_category,  // selected on hover, app id
        clicked_category,  // selected on click, app id
        pad = 10, // padding for boundary circle + app circles
        cap_apps = 3, // cap for the more button // TODO: change to 9
        nodes = {},
        force = 0,
        foci = 0, // to keep track of focal pos for each node
        collision_padding = 15, // padding for collisions
        svg,
        drag_category = "",
        selecting_clicked_category = "",
        selected_category_name = ""; // TODO: should probably change this

    $(document).ready(function() {
        svg = d3.select("#circles")
                    .append("svg")
                    .attr("width", WINDOW_WIDTH)
                    .attr("height", WINDOW_HEIGHT),
            defs = svg.append('defs');

        var dataset = [];

        // TEMPORARY WAY TO CREATE UNIQUE ID'S
        var id_index = 0;
        _.each(CAT_DATA, function(obj, key, list){
            var new_cluster = new window.Cluster(key, obj);
            new_cluster.id = 'category' + id_index;
            dataset.push(new_cluster);
            id_index += 1;
        });

        nodes = dataset;

        // keep track of the max number of apps (overall) for sizing
        var max_apps = -1;
        nodes.forEach(function(d, i) {
            if (dataset[i].apps.length > max_apps) {
                max_apps = dataset[i].apps.length;
            }
        });

        // force layout used for collisions
        force = d3.layout.force()
            .size([window_width, window_height])
            .nodes(nodes)
            .alpha(0.1)
            .charge(0) // charge is node-node attraction/repulsion
            .gravity(0) // gravity -> move to center
            .friction(0.3) // lower so doesn't bounce too much off boundary
            .on("tick", tick)
            .start();

        // groups contain category information
        var groups = svg.selectAll("g")
            .data(nodes)
            .enter()
            .append("g")
            .attr("id", function(x){
                return x.id;
            })
            .attr("transform", function(x, i) {
                calculate_radius(x, i, max_apps); // TODO: probably shouldn't be here

                // force layout will automatically choose x/y
                return "translate(" + [x.x, x.y] + ")";
            })
            .on("mouseenter", function(x, i) {
                // category selected
                if (!selected_category || selected_category != x.id) {
                    if (!clicked_category ||
                        (clicked_category != x.id)) {
                        // check if for some reason there's
                        // another selected category
                        if (selected_category &&
                            (selected_category != clicked_category))
                            if (selected_category != drag_category){
                                deselect_old_cluster(selected_category);
                            }
                        selected_category = x.id;
                        selected_category_name = x.name;
                        select_new_cluster(x);
                    }
                    else if (clicked_category) {
                        selecting_clicked_category = x.id;
                        selected_category_name = x.name;
                    }
                }
            })
            .on("mouseleave", function(x, i) {
                if (clicked_category != selected_category) {
                    if (x.id == selected_category) {
                        if (selected_category != drag_category) {
                            // add a radius check to reduce instabilities
                            // caused by mouseleave firing when a circle moves
                            // away from mouse on hover and doesn't transition
                            // radius size on time, not perfect in between circles
                            var circle = d3.select("#circle_" + x.id);
                            var check_x = d3.event.pageX - circle.attr("cx"),
                                check_y = d3.event.pageY - circle.attr("cy"),
                                dist = Math.sqrt(check_x*check_x + check_y*check_y);

                            // check the radius of the circle
                            var cr = circle.attr("r");
                            if (dist > cr) {
                                d3.transition().each("end", 
                                    deselect_old_cluster(selected_category));
                                selected_category = "";
                            }
                        }
                    }
                }
            })
            .on("mousedown", function(x){
                // make sure double click doesn't contract
                if (clicked_category != x.id) {
                    // deselect any previously clicked ones
                    // doesn't actually select otherwise
                    if (clicked_category)
                        deselect_old_cluster(clicked_category);
                    clicked_category = x.id;
                }
            });

        // category circles
        groups.append("circle")
            .attr("class", "vis-shape")
            .attr("r", function(x){
                return x.r;
            })
            //.style("fill", function(x, i){
                //return "hsl(" + i*(255/num_categories) + ",70%,40%)";
            //})
            .attr("id", function(x){
                return "circle_" + x.id;
            });

        groups.append("text")
            .text(function(x){
                return x.name;
            })
            .attr({
                "alignment-baseline": "middle",
                "text-anchor": "middle"
                //"font-family": "Helvetica"
            })
            .attr("class", "vis-label")
            .attr("id", function(x){
                return "text_" + x.id;
            })
            .style('fill', function(x, i){
                return "white";
            })
            .attr("font-size", function(x){
                // reduce the font size based on the radius
                if (0.16*x.r < 12)
                    return 12;
                return 0.16*x.r;
            });

        // append this only if there are more than cap_apps apps!
        groups.append("text")
            .text("MORE")
            .attr("id", function(x){
                return "more_" + x.id;
            })
            .attr({
                //"alignment-baseline": "middle",
                "text-anchor": "middle",
                "font-family": "Helvetica"
            })
            .attr("class", "vis-sublabel")
            .attr("font-size", function(x) {
                // reduce the font size based on the radius
                if (0.16*x.r < 12)
                    return 12;
                return 0.1*x.r;
            })
            .attr("display", function(d) {
                // change to visible when selecting category
                return "none";
            })
            .attr("dy", "18px")
            .on("mousedown", function(d, i) {
                more_apps(d, i);
            });

        // every group also has a less text
        groups.append("text")
            .text("LESS")
            .attr("id", function(x){
                return "less_" + x.id;
            })
            .attr({
                //"alignment-baseline": "middle",
                "text-anchor": "middle",
                "font-family": "Helvetica"
            })
            .attr("class", "vis-sublabel")
            .attr("font-size", function(x) {
                // reduce the font size based on the radius
                if (0.16*x.r < 12)
                    return 12;
                return 0.1*x.r;
            })
            .attr("display", function(d) {
                // change to visible when selecting category
                return "none";
            })
            .attr("dy", "18px")
            .on("mousedown", function(d, i) {
                less_apps(d, i);
            });

        // clicking on white space should deselect everything
        $('#circles').click(function(e) {
            // make sure it's not within a cluster
            if (!e.target.id) {
                if (clicked_category) {
                    deselect_old_cluster(clicked_category);
                    clicked_category = "";
                    selected_category = "";
                }
            }
        });

        // separate function so don't have to create apps on every hover
        create_apps();
    });

    function dragstart(d, i) {
        if (selecting_clicked_category)
            drag_category = selecting_clicked_category;
        else
            drag_category = selected_category;
    }

    function dragmove(d, i) {
        var drag_app = "#link" + i + "_img_" + drag_category;

        // move the drag category circle to the back so dragging over
        // other categories expands
        // this however puts the app behind everything else...
        var circle_group = document.getElementById(drag_category);
        circle_group.parentNode.insertBefore(
            circle_group, circle_group.parentNode.firstChild);

        var drag_app_obj = d3.select(drag_app),
            currx = parseFloat(drag_app_obj.attr("x")),
            curry = parseFloat(drag_app_obj.attr("y"));

        drag_app_obj
            .attr("x", function(){ return currx + d3.event.dx; })
            .attr("y", function(){ return curry + d3.event.dy; });
    }

    // TODO: FIX BUGS WHEN DRAGGING OUTSIDE
    function dragend(d, i) {
        // TODO: make this work for clicked category
        if (drag_category != "" && ((selected_category != drag_category &&
            selected_category != "") ||
            (selecting_clicked_category != drag_category &&
            selecting_clicked_category != ""))) {
            var dragging = drag_category; // TODO: wtf why do i have to redefine
            var selecting;
            if (selected_category == drag_category) {
                selecting = selecting_clicked_category;
                selecting_clicked_category == "";
            }
            else {
                selecting = selected_category;
                selected_category == "";
            }
            $.post("/apps/category", {
                "url": d.url,
                "category": selected_category_name
            },
            function(data) {
                if ("error" in data) {
                    console.log("error in change category: " + data["error"]);
                }
                else {
                    update_app_category(d, selecting, dragging);
                }
            });
        }
        else {
            d3.select("#link" + i + "_img_" + drag_category)
                .attr("x", d.x)
                .attr("y", d.y);
        }
        drag_category = "";
    }

    function calculate_radius(x, i, max_apps) {
        // scale the category circle and image size
        // get the r of enlarged circle (roughly, grid config)
        var r = Math.floor(Math.sqrt(
            (window_width*window_height)/(4*nodes.length)));

        // reduce it to r of the smaller circle
        x.r = (r - (2*pad))/1.8;

        // update the r for expansion
        var compare_apps = cap_apps;
        if (max_apps < cap_apps)
            compare_apps = max_apps;
        var length = x.apps.length;
        if (length > compare_apps)
            length = compare_apps;
        x.r = (length/compare_apps)*x.r;

        // cap it so it's not terribly big
        if ((x.r + x.r*0.8 + pad*2)*2 > window_height) {
            x.r = .25*window_height; // TODO: randomly chose
        }
        // cap it so it's not terribly small
        if (x.r < 50) {
            x.r = 50;
        }

        // x.r is unchanging radius
        // x.radius changes upon mouseenter/leave
        x.radius = x.r;
        x.app_img_size = 0.8*x.r;
    }

    function update_app_category(d, new_category, old_category) {
        var remove_cluster, add_cluster, app, remove_i,
            max_apps = -1; // TODO: consider making this global?

        // need to find the node with the category to remove it from
        // need to find the node with the category to add it to

        // TODO: will this be slow for large data?
        nodes.forEach(function(x, i) {
            var len = x.apps.length;
            if (x.id == new_category) {
                add_cluster = x;
                len++; // because will be adding to length
            }
            else if (x.id == old_category) {
                remove_i = i;
                remove_cluster = x;
                len--; // because will be removing from length
            }
            if (len > max_apps)
                max_apps = len;
        });

        // now get the app from the remove cluster
        for (var i = 0; i < remove_cluster.apps.length; i++) {
            if (remove_cluster.apps[i].url == d.url) {
                app = remove_cluster.apps[i];
                remove_cluster.apps.splice(i, 1);
                break;
            }
        }

        // add the app to the add cluster
        add_cluster.apps.push(app);

        // check the length of remove cluster, if 0 remove it
        if (remove_cluster.apps.length == 0) {
            nodes.splice(remove_i, 1);
            // remove the group of this category
            svg.select("#" + old_category)
                .transition()
                .remove();

            // TODO: reposition everything?
        }

        nodes.forEach(function(x, i) {
            calculate_radius(x, i, max_apps);
        });

        // now to update the clusters and the nodes
        // resize ALL clusters (max number of apps may have changed!)
        svg.selectAll("circle")
            .transition()
            .attr("r", function(x) {
                return x.r;
            });
        svg.selectAll(".vis-label")
            .transition()
            .attr("font-size", function(x){
                // reduce the font size based on the radius
                if (0.16*x.r < 12)
                    return 12;
                return 0.16*x.r;
            });
        svg.selectAll(".vis-sublabel")
            .transition()
            .attr("font-size", function(x) {
                // reduce the font size based on the radius
                if (0.16*x.r < 12)
                    return 12;
                return 0.1*x.r;
            });

        // remove ALL cluster images (because x.r changed for all categories)
        svg.selectAll("a")
            .attr("r", 0).remove();

        // add the cluster images back
        create_apps();

        // select the new category
        if (clicked_category != new_category) {
            clicked_category = new_category;
        }
        else {
            selected_category = "";
        }
        select_new_cluster(add_cluster);
        deselect_old_cluster(old_category);
    }

    // this creates all the apps as hidden
    function create_apps() {
        // add drag for category movement
        force.drag = d3.behavior.drag()
            .on("dragstart", dragstart)
            .on("drag", dragmove)
            .on("dragend", dragend);

        // add all the images from the start with 0 width
        nodes.forEach(function(x, i) {
            var d = x.apps,
                category = svg.selectAll("#" + x.id);

            var length = x.apps.length;
            if (length > cap_apps)
                length = cap_apps;
            var angle = (360/length)*Math.PI/180;

            var cluster_apps = {};
            cluster_apps[x.id] =
                category.selectAll()
                    .data(x.apps)
                    .enter()
                    .append("a")
                    .attr("data-category", x.name)
                    .attr("id", function(d, j) {
                        // we need an id for every object for unfocus to work
                        "link" + j + "_" + x.id;
                    })
                    .attr("xlink:href", function(d){
                        return "http://" + d.url; // TODO: fix
                    })
                    .classed(x.id, true);

            // append each image
            cluster_apps[x.id]
                .append('image')
                .attr('xlink:href', function(d) {
                    var that = this;
                    var j = d.url.indexOf("."),
                        name = d.url.substring(0, j);
                    // check to see if this image exists
                    var img = new Image();
                    img.src = "/img/app_icons/" + name + ".png";
                    img.onerror = function (evt) {
                        this.onerror = null;
                        this.src = '/img/app_icons/social-networks.png';
                        d3.select(that).attr('xlink:href', this.src);
                    };
                    return img.src;
                })
                .attr("id", function(d, j){
                    return "link" + j + "_img_" + x.id;
                })
                .attr("url_id", function(d){
                    return d.url;
                })
                .attr("close_id", function(d){
                    var date = d.close[d.close.length-1];
                    var val = new Date(date*1000);
                    return $.datepicker.formatDate('MM dd, yy', val);
                })
                .attr("timeStamp", function(d){
                    var date = d.close[d.close.length-1];
                    var val = new Date(date*1000);
                    return val.toLocaleTimeString();
                })
                .attr("x", function(d, j){
                    var dist = x.app_img_size/2 + x.r + pad;
                    d.x = Math.cos(angle*j)*dist;
                    d.x = d.x - x.app_img_size/2;
                    return d.x;
                })
                .attr("y", function(d, j){
                    var dist = x.app_img_size/2 + x.r + pad;
                    d.y = Math.sin(angle*j)*dist;
                    d.y = d.y - x.app_img_size/2;
                    return d.y;
                })
                .classed('image_' + x.id, true)
                .attr("width", function(d){
                    return 0;
                })
                .attr("height", function(d){
                    return 0;
                })
                .attr("display", function(d, j){
                    return "none";
                })
                .call(force.drag);
        });
        var c = svg.selectAll("image")[0];

        for(var count = 0; count < c.length; count++){
            currimg = c[count];
            currimg.addEventListener("mouseover",function(evt) {
                                    hoverFunction(this);}, false);
            currimg.addEventListener("mouseout",function(evt) {
                                    hoverOffFunction(this);}, false);
            currimg.addEventListener("mousedown", function(evt) {
                                    evt.stopPropagation();}, false);
        }
    }

    // collision & tick from https://gist.github.com/GerHobbelt/3116713
    function tick(e) {
        force.stop();
        var q = d3.geom.quadtree(nodes),
            i = 0,
            n = nodes.length;

        // there's nothing selected/clicked?
        if (!clicked_category && !selected_category) {
            if (foci) {
                // try to fix its location
                var k = .1 * e.alpha;
                nodes.forEach(function(o, i) {
                    if (o.id != clicked_category) {
                        o.y += (foci[i].y - o.y) * k;
                        o.x += (foci[i].x - o.x) * k;
                    }
                });
            }
        }
        
        //force.friction(0.1);
        while (++i < n) {
            q.visit(collide(nodes[i]));
        }

        // update the category positions based on collisions
        svg.selectAll("g")
            .each(cluster(10 * e.alpha * e.alpha))
            .attr("transform", function(d, i) {
                d.x = Math.max(d.radius,
                    Math.min(window_width - d.radius, d.x));
                d.y = Math.max(d.radius,
                    Math.min(window_height - d.radius, d.y));
                // save the positions if foci not set yet
                if (!foci) {
                    // save this value of x and y to fix to this position
                    foci = [];
                }
                if (!foci[i]) {
                    // collide one more time to ensure no overlap
                    foci[i] = {x: d.x, y: d.y};
                }
                return "translate(" + [d.x, d.y] + ")";
            })
        force.resume();
    }

    // Move d to be adjacent to the cluster node.
    function cluster(alpha) {
        var max;

        // Find the largest node for each cluster.
        // whatever one is selected is the 'max' so it will center
        nodes.forEach(function(d) {
            if (!clicked_category) {
                if (!max || (d.r > max.r))
                    max = d;
            }
            else {
                if (d.id == clicked_category)
                    max = d;
            }
        });

      return function(d) {
        var node = max,
            l, r, x, y,
            k = 1,
            i = -1;

        // For cluster nodes, apply custom gravity.
        if (node == d) {
          node = {x: window_width/2, y: window_height/2, radius: -d.radius};
          k = .1 * Math.sqrt(d.radius);
        }

        x = d.x - node.x;
        y = d.y - node.y;
        l = Math.sqrt(x * x + y * y);
        r = d.radius + node.radius;
        if (l != r) {
            l = (l - r) / l * alpha * k;
            d.x -= x *= l;
            d.y -= y *= l;
            node.x += x;
            node.y += y;
        }
        };
    }

    // Resolve collisions between nodes.
    function collide(node) {
        var r = node.radius + collision_padding;
            nx1 = node.x - r,
            nx2 = node.x + r,
            ny1 = node.y - r,
            ny2 = node.y + r;
        return function(quad, x1, y1, x2, y2) {
            if (quad.point && (quad.point !== node)) {
                var x = node.x - quad.point.x,
                    y = node.y - quad.point.y,
                    l = Math.sqrt(x * x + y * y),
                    r = node.radius + quad.point.radius + collision_padding;
                // there's a collision if distance is less than r
                if (l < r) {
                    l = (l - r) / l * .1;
                    node.x -= x *= l;
                    node.y -= y *= l;
                    quad.point.x += x;
                    quad.point.y += y;
                }
            }
            return x1 > nx2 ||
                   x2 < nx1 ||
                   y1 > ny2 ||
                   y2 < ny1;
        };
    }

    function select_new_cluster(x) {
        var selected_circle = d3.select("#circle_" + x.id),
            selected_text = d3.select("#text_" + x.id),
            r = x.r;

        selected_circle.transition()
            .attr("r", function(x){
                x.radius = r + x.app_img_size + pad*2;
                return x.radius;
            });
        
        // need to keep both selected so parent is the only unclassed
        selected_circle.classed("selected", true);
        selected_text.classed("selected", true);

        var category = svg.selectAll("#" + x.id);

        // cap the data for x.apps...
        var capped_apps = [];
        if (x.apps.length < cap_apps)
            capped_apps = x.apps;
        else {
            for (var j = 0; j < cap_apps; j++) {
                capped_apps[j] = x.apps[j];
            }
        }

        d3.selectAll(".image_" + x.id)
            .transition()
            .attr("width", function(d){
                // make the app img about 80% size of category
                return x.app_img_size;
            })
            .attr("height", function(d){
                return x.app_img_size;
            })
            .attr("display", function(d, j){
                // hide them if they're above the cap;
                if (j >= cap_apps)
                    return "none";
                return "visible";
            });

        // make the more visible for those categories with too many apps
        svg.select("#more_" + x.id)
            .attr("display", function(x){
                if (x.apps.length > cap_apps &&
                    ((x.id == selected_category) || // TODO: is this double counted?
                    (x.id == clicked_category))) {
                    // check if it's selected
                    return "visible";
                }
                else
                    return "none";
            });
    }

    function deselect_old_cluster(old_category) {
        // old_category is the cluster to deselect (either clicked or selected)

        var old_cluster, selected_obj;

        // first deselect the circle
        old_cluster = typeof old_category === 'undefined' ? svg.selectAll() :
            svg.selectAll("#circle_" + old_category);

        selected_obj = old_cluster.classed('selected', false)
            .transition()
            .attr('r', function(d){
                d.radius = d.r;
                return d.r;
            });

        // then deselect the circle's images
        old_cluster = typeof old_category === 'undefined' ? svg.selectAll() :
            svg.selectAll(".image_" + old_category);
        selected_obj = old_cluster.classed('selected', false)
            .transition()
            .attr('width', 0)
            .attr('height', 0);

        // make the more button not visible
        svg.select("#more_" + old_category)
            .attr("display", "none");

        var old_apps = typeof old_category === 'undefined' ? svg.selectAll()
            : svg.selectAll("." + old_category);
        old_apps.transition().attr('r', 0);
    }

    function parse_data(json) {
        // grab the categories
        var new_json = {},
            dataset = [],
            categories = _.unique(_.pluck(_.values(json), 'category'));

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

    function hoverFunction(x){
        if(x.attributes.close_id.value != "undefined NaN, NaN"){
        printClusterStats(x.attributes.url_id.value, "username",
                        x.attributes.close_id.value,
                        x.attributes.timeStamp.value);
    }
    else{
         printClusterStats(x.attributes.url_id.value, "username",
                        "No Visits",
                        "");       
    }
        show_stats();
        // TODO: change so it will just be in the css
        document.body.style.cursor = 'pointer';
    }

    function hoverOffFunction(x){
        hide_stats();
        // TODO: change so it will just be in the css
        document.body.style.cursor = 'default';
    }

    // displays the shadow box over apps for more apps
    function more_apps(d, i) {
        //force.stop(); // TODO: do force stop and fix the position
        // TODO: bug, right clicking in more causes apps to go back
        // to their original place?
        var circle = svg.select("#circle_" + d.id)
            .transition()
            .attr("r", WINDOW_WIDTH)
            .transition()
            .style("opacity", "0.7");

        // hide the more link
        svg.select("#more_" + d.id)
            .attr("display", "none");

        // bring up a less link
        svg.select("#less_" + d.id)
            .attr("display", "visible");

        // move the circle's group to the front
        var circle_group = document.getElementById(d.id);
        circle_group.parentNode.appendChild(circle_group);

        // move the label to the very top
        svg.select("#text_" + d.id)
            .transition()
            .attr("y", -window_height/2 + 20);
        
        svg.select("#less_" + d.id)
            .transition()
            .attr("y", -window_height/2 + 22);

        var label_height = 50;
        var new_width = 77, // TODO: change so based on browser width/height
            count = Math.floor((window_width - pad) / (new_width + pad)),
            new_space,
            start_pos = {x: -window_width/2 + pad,
                        y: -window_height/2 + pad + label_height},
            space = new_width + pad;

        svg.selectAll(".image_" + d.id)
            .transition()
            .attr("x", function(x, j){
                // check if x position is gerater than the window width
                if (j < count)
                    new_space = space*j;
                else
                    new_space = space*(j % count);
                return start_pos.x + new_space;
            })
            .attr("y", function(x, j){
                return start_pos.y + Math.floor(j/count)*space;
            })
            .attr("width", new_width)
            .attr("height", new_width)
            .attr("display", "visible");
    }

    function less_apps(d, i) {
        //force.resume();
        svg.select("#circle_" + d.id)
            .transition()
            .attr("r", d.radius)
            .transition()
            .style("opacity", 1);

        // bring up more link
        svg.select("#more_" + d.id)
            .attr("display", "visible");

        // hide the less link
        svg.select("#less_" + d.id)
            .attr("display", "none");

        // move the label back
        svg.select("#text_" + d.id)
            .transition()
            .attr("y", 0);

        // move all the apps back to where they are
        svg.selectAll(".image_" + d.id)
            .transition()
            .attr("x", function(x){
                return x.x;
            })
            .attr("y", function(x){
                return x.y;
            })
            .attr("width", d.app_img_size)
            .attr("height", d.app_img_size)
            .attr("display", function(x, j){
                if (j >= cap_apps)
                    return "none";
                return "visible";
            });
    }

    function printClusterStats(s, u, l, t){
        printThatApp(s);
        //printUsername(u);
        printLastVisit(l);
        clearLastTime(t);  
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
        f.appendChild(f.ownerDocument.createTextNode("Last Visit: "));
        var br = document.createElement("br");
        f.appendChild(br);
        f.appendChild(f.ownerDocument.createTextNode(d));
    }
     
    function clearLastTime(d){
        var f = document.getElementById("lasttime");
        while(f.childNodes.length >= 1) {
            f.removeChild(f.firstChild);
        }
        f.appendChild(f.ownerDocument.createTextNode(d));
    }

};
