/* SRT converter by Doctor Snuggles */

"use strict";

var srt = (function (my) {
  //
  // Init
  //
  var my = {    // return object
    type: 'multi', // 'multi', 'single'
    offset: 0,     // offset in ms
    gap: 0,        // gap length in ms
  },
  j,  // holds json
  fN, // fileName for later download
  lastEnd = 0, // for gap detection
  even = false, // for dialog coloring
  debug = false;      // DEBUG mode

  // start the app
  doInit();

  //
  // Private
  //
  function log(out) {
    if (debug) console.log("App:", out);
  }
  function doInit() {
    log('doInit');

    // create the HTML Elements
    var a = [];
    a.push('<header id="info"></header>');
    a.push('<main id="app"><center>Drop SRT file</center></main>');

    document.body.innerHTML += a.join("");
    addDropHandler();
  }

  //
  // Helper functions
  //
  function timeToMS(t) {
    // hh:mm:ss,tttt
    // In SRT decimal sign is always comma "," never dot "." thanks to our french friend!
    var ms = t.substr(0,2) * 60*60*1000; // hh
    ms += t.substr(3,2) * 60*1000; // mm
    ms += t.substr(6,2) * 1000; // ss
    ms += t.substr(9)*1; // tttt
    return ms;
  }
  function MSToTime(ms) {
    // adds offset
    ms += my.offset;
    var hh, mm, ss, neg;
    var neg = "";
    if (ms < 0) {
      neg = "-";
      ms *= -1;
    }
    hh = Math.floor(ms/1000/60/60);
    ms -= hh * 1000*60*60;
    mm = Math.floor(ms/1000/60);
    ms -= mm * 1000*60;
    ss = Math.floor(ms/1000);
    ms -= ss * 1000;
    return neg + padLeft(hh)+':'+padLeft(mm)+':'+padLeft(ss)+','+padLeft3(ms);
  }
  function padLeft(n) {
    if (n < 10) n = "0" + n;
    return n;
  }
  function padLeft3(n) {
    if (n < 10) {
      n = "00" + n;
    } else if (n < 100) n = "0" + n;
    return n;
  }
  function addDropHandler() {
    // preventDefaults on all drag related events
    var dropArea = document.body;
    dropArea.addEventListener("drop", preventDefaults, false);
    dropArea.addEventListener("dragdrop", preventDefaults, false);
    dropArea.addEventListener("dragenter", preventDefaults, false);
    dropArea.addEventListener("dragleave", preventDefaults, false);
    dropArea.addEventListener("dragover", preventDefaults, false);

    // handler on drop
    dropArea.addEventListener("drop", dropHandler, false);
    dropArea.addEventListener("dragdrop", dropHandler, false);
  }
  function preventDefaults(e) {
    e.preventDefault();
  }
  function dropHandler(e) {
    var file = null;
    if (e.dataTransfer.items) {
      for (var i = 0; i < e.dataTransfer.items.length; i++) {
        if (e.dataTransfer.items[i].kind === "file") {
          file = e.dataTransfer.items[i].getAsFile();
          // write file infos
          var inf = [];
          fN = file.name;
          inf.push('<div><b>Filename:</b> '+ file.name);
            inf.push('&nbsp;&nbsp;<span id="err">');
              inf.push('<button id="ctc" onclick="srt.copyToClip();">Copy<br/>all to<br/>clipboard</button>');
              inf.push('<button id="dl" onclick="srt.getSRT();">Download<br/>SRT</button>');
              inf.push('<select id="sel" onchange="srt.changeType();"><option value="multi">Multi line</option><option value="single">Single lines</option></select>');
              inf.push('&nbsp;&nbsp;<input title="Enter offset in shown format\n+hh:mm:ss,0000\n-hh:mm:ss,0000" id="off" size="13" maxsize="13" value="-00:00:00,000" onchange="srt.changeOffset();"/>');
              inf.push('&nbsp;&nbsp;<input title="Enter max gap length between subtitles\nhh:mm:ss,0000" id="gap" size="12" maxsize="12" value="00:00:00,000" onchange="srt.changeGapLength();"/>');
            inf.push('</span></div>');
          inf.push('<div><b>Filesize:</b> '+ (file.size/1024).toFixed(2) +' kB</div>');
          inf.push('<div><b>Modified:</b> '+ file.lastModifiedDate +'</div>');
          info.innerHTML = inf.join("");
          break;
        }
      }
    } else {
      for (var i = 0; i < e.dataTransfer.files.length; i++) {
        file = e.dataTransfer.files[i];
        break;
      }
    }

    if (file) {
      if (file.size <= 10 * 1024 * 1024) /* 10MB max */ {
        // ToDo: encoding detection, actually just UTF-8
        var reader = new FileReader();
        reader.readAsText(file);
        reader.onloadend = function() {
          parseSRT(reader.result);
        }
      } else {
        log("File too large (>10MB)");
      }
    }
  }
  function parseSRT(s) { // string
    // https://en.wikipedia.org/wiki/SubRip
    var l = s.split("\n"); //lines
    j = {}; // final output object
    var id;
    for (var i = 0; i < l.length; i++) {
      // skip empty line
      if (l[i].length === 0 || l[i].charCodeAt(0) === 13) continue;

      // numeric := ID
      if (!isNaN(l[i])) {
        id = l[i]*1;
        j[id] = {lines:[]};
        continue;
      }

      // --> contains start and end
      if (l[i].indexOf(" --> ") !== -1) {
        j[id].start = timeToMS( l[i].substr(0,12) );
        j[id].end = timeToMS( l[i].substr(17) );
        continue;
      }

      // still here but without id.. error
      if (!j[id]) {
        log("Unknown format");
        err.innerHTML = "Unknown format";
        app.innerHTML = "<center>Drop SRT file</center>";
        return false;
      }

      // text lines
      j[id].lines.push(l[i]);
    }

    log(j);
    JSONtoHTML();
  }
  function JSONtoHTML() {
    var a = [];
    a.push('<table id="tbl" cellspacing="0" cellpadding="0" border="1">');
    a.push('<thead>');
      a.push('<th>Nr.</th>');
      a.push('<th>Start</th>');
      a.push('<th>End</th>');
      a.push('<th>Text</th>');
    a.push('</thead>');
    a.push('<tbody>');
    for (var i in j) {
      // gap detection
      if (j[i].start*1 - lastEnd*1 > my.gap*1 && my.gap !== 0) {
        a.push('<tr>');
        a.push('<td colspan="4" class="spacer">&nbsp;</td>');
        a.push('</tr>');
        even = !even;
      }

      if (my.type === 'multi') {
        if (even) {
          a.push('<tr class="even">');
        } else {
          a.push('<tr class="odd">');
        }
        a.push('<td>'+ i +'</td>');
        a.push('<td>'+ MSToTime( j[i].start ) +'</td>');
        a.push('<td>'+ MSToTime( j[i].end ) +'</td>');
        a.push('<td>'+ j[i].lines.join("<br/>") +'</td>');
        a.push('</tr>');
      }
      if (my.type === 'single') {
        for (var l in j[i].lines) {
          if (even) {
            a.push('<tr class="even">');
          } else {
            a.push('<tr class="odd">');
          }
          a.push('<td>'+ i +'</td>');
          a.push('<td>'+ MSToTime( j[i].start ) +'</td>');
          a.push('<td>'+ MSToTime( j[i].end ) +'</td>');
          a.push('<td>'+ j[i].lines[l] +'</td>');
          a.push('</tr>');
        }
      }
      lastEnd = j[i].end;
    }
    a.push('</tbody>');
    a.push('</table>');
    log(a);
    app.innerHTML = a.join("");
  }
  function JSONtoSRT() {
    var a = [];
    for (var i in j) {
      //if (my.type === 'multi') {
        a.push(i);
        a.push("\n");
        a.push(MSToTime( j[i].start ) +' --> '+ MSToTime( j[i].end ));
        a.push("\n");
        a.push(j[i].lines.join("\n"));
        a.push("\n");
        a.push("\n");
      //}
      /*
      if (my.type === 'single') {
        for (var l in j[i].lines) {
          a.push(i);
          a.push("\n");
          a.push(MSToTime( j[i].start ) +' --> '+ MSToTime( j[i].end ));
          a.push("\n");
          a.push(j[i].lines[l]);
          a.push("\n");
          a.push("\n");
        }
      }
      */
    }
    log(a);
    return a.join("");
  }
  function selectElementContents(el) {
    var body = document.body, range, sel;
    if (document.createRange && window.getSelection) {
      range = document.createRange();
      sel = window.getSelection();
      sel.removeAllRanges();
      try {
        range.selectNodeContents(el);
        sel.addRange(range);
      } catch (e) {
        range.selectNode(el);
        sel.addRange(range);
      }
    } else if (body.createTextRange) {
      range = body.createTextRange();
      range.moveToElementText(el);
      range.select();
    }
    document.execCommand("Copy");
  }
  function download(content, fileName) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], {type: 'text/plain'}));
    a.setAttribute('download', fileName);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  function getSRT() {
    var filename = fN + "_"+ my.type +"_"+ my.offset +"_processed.srt";
    download(JSONtoSRT(), filename);
  }

  //
  // public
  //
  my.copyToClip = function() {
    selectElementContents(tbl);
  };
  my.changeType = function() {
    my.type = sel.value;
    JSONtoHTML();
  }
  my.changeOffset = function() {
    my.offset = timeToMS( off.value.substr(1) );
    if (off.value.substr(0, 1) === "-") {
      my.offset *= -1;
    }
    JSONtoHTML();
  }
  my.changeGapLength = function() {
    my.gap = timeToMS( gap.value );
    JSONtoHTML();
  }
  my.getSRT = getSRT;

  return my;
}(srt || {}));
