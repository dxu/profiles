var baseUrl = "http://davidxu.me:3000";
//var baseUrl = "http://127.0.0.1:3000";
var apiUrlOpen = baseUrl + "/apps/open";
var apiUrlClose = baseUrl + "/apps/close";
var userid = null;
var storage = chrome.storage.local;
var tabDomains = {}; // maps tab ids to URLs
var activeDomains = {}; // domains that are open already
var whitelist = [];
var _recording = true;
var focusedTabDomain = null;
// david
var old_focus_domain;
var current_focus_domain;
var focus_open_time;
var focus_close_time;

// the time of the significant focus last changed
var focusChangeTime = null; 
// time spent on a tab for it to be considered a significant focus change
// in seconds
var timeThreshold = 5; 

$(document).ready(function() {
  setTimeout(init, 1000);
});

function init() {
  // Get stored userid
  storage.get({"userid": null}, function(items) {
    userid = items.userid; 
    // If userid has logged in before
    if (userid) {
      chrome.browserAction.setIcon({path: "green.png"}, function(){});
      console.log("Loaded userid " + userid);
      tabDomains = {};
      activeDomains = {};
      getWhitelist();
    }
    else {
      // Set icon to red if not logged in
      chrome.browserAction.setIcon({path: "red.png"}, function(){});
    }
  });
}

//==================
// Init functions
//==================

function checkDirtyClose() {
  // see if we have active domains stored in chrome storage
  storage.get({"activeDomains": null, "lastKnownTime": null, 
                "focusedTabDomain": null}, 
    function(items) {
      var posixTime = items.lastKnownTime;
      if (!posixTime) {
        posixtime = getCurrentTime();
      }

      // if any dirty-closed domains, record a close time of last
      // known time, or current time if no last known time
      var domains = items.activeDomains;
      if (domains) {
        //console.log("dirty-closed domains: ");
        //console.log(domains);
        for (var d in domains) {
          if (isInWhitelist(d)) {
            var appId = domains[d]["appId"];
            postToClose(d, appId, posixTime);
          }
        }
      }

      // record close for tab that was not unfocused, if exists
      if (focusedTabDomain) {
        // TODO: DAVID
        // postToUnfocus(focusedTabDomain, posixTime); 
      }

      // Reset stored active domains
      storage.set({"activeDomains": null});
      registerAllTabs();
      // Begin logging time every 5s to prepare for dirty close
      window.setInterval(logTime, 5000);
      // Begin automatic update of whitelist
      //window.setInterval(pollForWhitelist, 1000);
  });
};

// Gets all open tabs and stores their domains in memory and in chrome storage
// Sends POST request to backend to register their open times
// Call this function if the extension is loaded after tabs have been opened
// or if the user logs in after tabs have been loaded
function registerAllTabs() {
  chrome.windows.getAll({"populate": true}, function(windows) {
    // For every window, get the tabs of that window
    for (var i = 0; i < windows.length; i ++ ) {
      var tabs = windows[i].tabs;
      for (var j = 0; j < tabs.length; j ++ ) {
        // Handle the URL of this tab
        var id = tabs[j].id;
        var url = tabs[j].url;
        processUrl(id, url);
      }
    }
  });
  // Store all the active domains
  storage.set({"activeDomains": activeDomains});
}

//==================
// Other functions
//==================

// Records the time to Chrome storage
function logTime() {
  var time = Math.round((new Date()).getTime() / 1000);
  storage.set({"lastKnownTime": time});
};

function pollForWhitelist() {
  $.getJSON(baseUrl + "/users/" + userid + "/whitelist.json",
    function(data){
      whitelist = data;
      // Effectively chain callbacks so init() executes in order
    });
};

// Make appropriate web requests when a tab is created or changed
function processUrl(tabId, url) {
  var domain = getDomain(url);

  // If user opened chrome://*, ignore and return
  var excludedDomains = ["chrome", "extensions", "devtools"];
  if (excludedDomains.indexOf(domain) != -1) {
    return false;
  }

  // Get the last known domain for this tab
  var oldDomain = tabDomains[tabId];

  // if new tab
  if (tabDomains[tabId] == null) {
    // Record the domain for this tab
    tabDomains[tabId] = domain;
    // Process the domain
    incrementDomainCount(domain);
    chrome.tabs.get(tabId, function(tab) {
      if (tab.active) {
        // Update the focus
        var oldFocused = focusedTabDomain;
        updateFocus(domain, oldFocused);
      }
    });
  }
  // if user navigated from one domain to another
  else if (oldDomain != domain) {
    // Increment number of active tabs with this domain
    incrementDomainCount(domain);

    // Decrement domain user just navigated away from
    decrementDomainCount(tabDomains[tabId]);

    var oldFocused = focusedTabDomain;
    updateFocus(domain, oldFocused);
  }
  // else, user has navigated from one page to another on same domain

  // Remember the current domain for this tab in case we close it later
  tabDomains[tabId] = domain;
};

// Increment the number of tabs open for a domain
// If no tabs open yet, POST to /open
function incrementDomainCount(domain) {
  // If this app is not in the whitelist, just return
  if(!isInWhitelist(domain)) {
    return;
  }

  // If this domain is already open in another tab
  if (domain in activeDomains) {
    activeDomains[domain]["count"] = activeDomains[domain]["count"] + 1;
  }
  // If user is logged in and this is the first tab for this domain
  else if (!(domain in activeDomains) && userid) {
    postToOpen(domain);
  }
}

// Decrement the counter for number of tabs open with this domain
// If the counter reaches 0, POST to /close
function decrementDomainCount(domain) {
  // If this app is not in the whitelist or not in active domains, just return
  if(!isInWhitelist(domain) || !(domain in activeDomains)) {
    return;
  }

  // If last tab for that domain, make POST to /close
  if (domain in activeDomains && activeDomains[domain]["count"] == 1) {
    var appId = activeDomains[domain]["appId"];
    //console.log("No more tabs open for " + domain);
    // Only POST if user logged in and domain is in whitelist
    if (userid && isInWhitelist(domain)) {
      postToClose(domain, appId, getCurrentTime());
    }
  }
  // Else, decrement
  else {
    activeDomains[domain]["count"] = activeDomains[domain]["count"] - 1;
    //console.log(activeDomains[domain]["count"] + " tabs open for " + domain);
  }
  // Update stored version of activeDomains
  storage.set({"activeDomains": activeDomains});
};

// Gets the list of approved apps for tracking
function getWhitelist() {
  $.getJSON(baseUrl + "/users/" + userid + "/whitelist.json",
    function(data){
      whitelist = data;
      // Effectively chain callbacks so init() executes in order
      checkDirtyClose();
    });
}

function isInWhitelist(domain) {
  return (whitelist.indexOf(domain) != -1); 
};

// Add a url's domain to the allowed apps
function addToWhiteList(url) {
  var domain = getDomain(url);
  console.log("Adding " + domain + " to whitelist");
  if (whitelist.indexOf(domain) == -1) {
    whitelist.push(domain);
    postToAllowApp(domain);
    registerAllTabs();
  }
};

// Remove a url's domain from the allowed apps
function removeFromWhiteList(url) {
  var domain = getDomain(url);
  console.log("Removing " + domain + " from whitelist");
  if (whitelist.indexOf(domain) != -1) {
    whitelist.splice(whitelist.indexOf(domain), 1);
    postToDisallowApp(domain);
  }
}



//=======================
// Request Functions
//=======================

function postToClose(domain, appId, posixTime) {
  // check for invalid app id
  if (!appId) {
    console.log("WARNING APPID IS NULL");
  }
  // Remove this domain from list of active domains
  delete activeDomains[domain];
  var postData = {"appid": appId, "close_date": posixTime};
  $.post(apiUrlClose, postData, function() {});
  console.log("POST to close for " + domain);
};

// Add a domain to the list of active domains, then POST it to /open
function postToOpen(domain) {
  // add to list of active domains
  activeDomains[domain] = {"count": 1};

  // get time
  var posixTime = getCurrentTime();

  var postData = {
    "userid": userid,
    "open_date": posixTime,
    "url": domain,
    "img_url": "placeholder.jpg"
  };

  // make post request
  $.ajax({
    type: "POST",
    url: apiUrlOpen,
    data: postData,
    success: function(data) {
      // update this domain's appid
      activeDomains[domain]["appId"] = data["appid"];
      // save active domains to chrome storage
      storage.set({"activeDomains": activeDomains});
      console.log("Successful POST to open for " + domain);
    },
    error: function(xhr, status, e) {
      console.log("Error in POST to open:\n" + e);
      // remove domain from active domains
      delete activeDomains[domain];
    }
  });
};

// Make POST request to allow a domain to be tracked
function postToAllowApp(domain) {
  if (!userid) {
    console.log("Null userid, cannot POST"); 
    return;
  }
  var postData = {"id": userid, "domain": domain};
  var route = "/users/allow";
  $.post(baseUrl + route, postData, function(data, status, xhr) {
    console.log("Succesful POST to " + route + "; domain: " + domain);
    console.log("Response:");
    console.log(data);
  });
};

// Make POST request to disallow a domain from being tracked
function postToDisallowApp(domain) {
  if (!userid) {
    console.log("Null userid, cannot POST"); 
    return;
  }
  var postData = {"id": userid, "domain": domain};
  var route = "/users/disallow";
  $.post(baseUrl + route, postData, function(data, status, xhr) {
    console.log("Succesful POST to " + route + "; domain: " + domain);
    console.log("Response:");
    console.log(data);
  });
};

function postToFocus(domain, time) {
  if (domain == null) {
    //console.log("no domain in post to focus");
    return;
  }
  current_focus_domain = domain;
  // record domain in global variable
  // TODO: DAVID
    // $.post(baseUrl + "/apps/focus", 
    //   {"userid": userid, "url": domain, "time": time}, 
    //   function(data) {
    //     focusedTabDomain = domain;
    //     storage.set({"focusedTabDomain": focusedTabDomain});
    //     //console.log(data);
    //     console.log("focus " + data["url"] + " #" + data["focus_count"]);
    //   });
}

function postToUnfocus(domain, time) {
  console.log("this is the domain")
  console.log(domain)
  console.log("this is the domain focus")
  console.log(current_focus_domain)
  console.log(current_focus_domain)
  if (!domain || !isInWhitelist(domain)) {
    //console.log("no domain in unfocus");
    return;
  }
  $.post(baseUrl + "/apps/unfocus", 
    {"userid": userid, "url": domain, "time": time}, 
    function(data) {
      focusedTabDomain = null;
      storage.set({"focusedTabDomain": null});
    console.log("unfocus " + data["url"] + " #" + data["unfocus_count"]);
    });

}
//===============
// Utilities
//===============

// Returns a domain of form domain.com from a url
function getDomain(url) {
  if (!url || url == "undefined") {
    return null;
  }
  var domain = $.url(url).attr("host");
  // check for chrome://* domains
  if (domain.indexOf("chrome://") !== -1) {
    return "chrome";
  }

  // special case for mail.google.com
  if (domain.indexOf("mail.google.com") !== -1) {
    
    return "mail.google.com";
  }

  var firstIndex = domain.indexOf(".");
  if (firstIndex == domain.lastIndexOf(".")) {
    return domain;
  }
  return domain.substring(firstIndex + 1, domain.length);
}

function getCurrentTime() {
  return Math.round(new Date().getTime() / 1000);
}

function printStoredActiveDomains() {
  storage.get({"activeDomains": null}, function(items) {
      console.log(items);
      console.log(items.activeDomains);
  });
}

//==============================
// Chrome listeners and helpers
//==============================

// Message listener to listen to popup.js
chrome.extension.onMessage.addListener(function(message, sender, sendResponse) {
  console.log("message listener");
  console.log(message);

  // Toggle recording
  if ("recording" in message) {
    toggleRecording(message);
  }

  // If user has turned off recording, do nothing
  if (!_recording) {
    return;
  }
  
  // Handle userid returned from chrome extension login
  if ("userid" in message) {
    setUserId(message);
  }

  // Handle add app
  /*
  if ("allowed_url" in message) {
    var url = message["allowed_url"];
    if ("tabid" in message) {
      var tabId = message["tabid"];
      addToWhiteList(url);
      tabDomains[tabId] = getDomain(url); 
    }
  }

  /*
  // Handle disallow app
  if ("disallowed_url" in message) {
    var url = message["disallowed_url"];
    if ("tabid" in message) {
      var tabId = message["tabid"];
      removeFromWhiteList(url);
      tabDomains[tabId] = getDomain(url); 
    }
  }
  */
});

// Turn tracking on or off
function toggleRecording(message) {
    _recording = message["recording"];
    if (_recording) {
      init();
    }
    console.log("recording: " + _recording);
};

// Sets userid locally and in chrome storage and calls init()
function setUserId(message) {
    userid = message["userid"];
    storage.set({"userid": userid}, function() {
      console.log("Stored user id " + userid);
      init();
    });
};

// Application on install listener
// fires when application is installed or reloaded
chrome.runtime.onInstalled.addListener(function(details) {
  console.log("Installed app");
  // Clear chrome storage variables that are left over
  storage.remove(["userid", "activeDomains"]);
});

// Tab created listener
chrome.tabs.onCreated.addListener(function(tab) {
  // If user has toggled off recording, do nothing
  if (!_recording) {
    return;
  }
  //tabDomains[tab["id"]] = null;
});

// Tab focused listener
chrome.tabs.onActivated.addListener(function(activeInfo) {
  
  var tabId = activeInfo["tabId"];
  chrome.tabs.get(tabId, function(tab) {
    
    var domain = getDomain(tab.url);
    if (!userid) {
      console.log("Not logged in");
      return;
    }

    var time = getCurrentTime();
    old_focus_domain = current_focus_domain;
    current_focus_domain = domain;
    // SUBMIT REQUEST, but only if both focus close time and focus open time are defined

    focus_close_time = time;

    if(focus_close_time && focus_open_time && focus_close_time !== focus_open_time && old_focus_domain) {
      $.post(baseUrl + "/apps/focus_pair", 
        {"userid": userid, "url": old_focus_domain, "focus_time": focus_open_time, "unfocus_time": focus_close_time}, 
        function(data) {
          // focusedTabDomain = null;
          // storage.set({"focusedTabDomain": null});
          console.log('successfully ofcused!')
          console.log(data);
          console.log(focus_open_time);
          console.log(focus_close_time);
          console.log("unfocus " + data["url"] + " #" + data["unfocus_count"]);
          // update old focus time on success
          focus_open_time = focus_close_time;
      });
    }
    focus_open_time = focus_close_time;

    console.log(current_focus_domain)
    var oldFocused = focusedTabDomain;
    updateFocus(domain, oldFocused);
  });
});

// update focus
function updateFocus(newDomain, oldFocused) {
  // console.log('inside updatefocus')
    // console.log(oldFocused)
    // console.log(newDomain)
  if (newDomain == oldFocused) {
    return;
  }
  var time = getCurrentTime();
  focusedTabDomain = newDomain;
  //console.log({"old": oldFocused, "new": newDomain});

  // POST to end focus of current domain
  if (oldFocused) {
    //console.log("calling postToUnfocus");
    // TODO: DAVID
    // postToUnfocus(oldFocused, time);
  }
  else {
  //  console.log("no oldfocused in updatefocus");
  }
  if (isInWhitelist(newDomain)) {
    // postToFocus(newDomain, time);
  }
}

// Tab updated listener
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {         
  // If user has toggled off recording, do nothing
  if (!_recording) {
    console.log("Not recording");
    return;
  }
  // If tab has no URL yet, return
  if (!("url" in changeInfo) || changeInfo["url"] == "chrome://newtab/") {
    return;
  }
  // console.log('inside tabs updated')
  // console.log(tabId)
  // console.log(tab)
  // console.log(changeInfo)
  processUrl(tabId, tab["url"]);
});

chrome.tabs.onReplaced.addListener(function(addedTabId, removedTabId) {
  tabDomains[addedTabId] = tabDomains[removedTabId];
  delete tabDomains[removedTabId];
});

// Tab close listener
chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
  // If user has toggled off recording, do nothing
  if (!_recording) {
    return;
  }
  // Wait 1s - if this listener is triggered by application quit,
  // we want to register the close next time Chrome is opened
  // so decrementDomainCount() doesn't quit in the middle of execution
  var closedDomain = tabDomains[tabId];
  setTimeout(function(){
    if (tabId in tabDomains) {
      delete tabDomains[tabId];
      decrementDomainCount(closedDomain);
    }
  }, 1000);
});

// Window focus change listener
chrome.windows.onFocusChanged.addListener(function(windowId) {
  console.log('ONFOCUSCHANGED')
  if (!userid || !_recording) {
    return;
  }
  // Unfocused from chrome; record unfocus for current focused tab
  if (windowId == -1) {
    // TODO: DAVID
    // postToUnfocus(focusedTabDomain, getCurrentTime());
    return;
  }
  // Get the new focused window
  chrome.windows.get(windowId, {'populate': true}, function(w) {
    var tabs = w.tabs;
    // Get the active tab
    var activeTab = null;
    for (var i = 0; i < tabs.length; i ++) {
      if (tabs[i].active) {
        activeTab = tabs[i];
      }
    }
    var d = getDomain(activeTab.url);

    console.log("Window switched; active tab domain " + d);
    var oldFocused = focusedTabDomain;
    updateFocus(getDomain(activeTab.url), oldFocused);
  });

});
