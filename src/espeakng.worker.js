var Module = typeof Module != "undefined" ? Module : {};
var Module = typeof Module !== "undefined" ? Module : {};
if (!Module.expectedDataFileDownloads) {
  Module.expectedDataFileDownloads = 0;
}

var ENVIRONMENT_IS_WEB = typeof window == "object";
var ENVIRONMENT_IS_WORKER = typeof importScripts == "function";
var ENVIRONMENT_IS_NODE =
  typeof process == "object" &&
  typeof process.versions == "object" &&
  typeof process.versions.node == "string";
var scriptDirectory = "";

var read_, readAsync, readBinary, setWindowTitle;
function logExceptionOnExit(e) {
  if (e instanceof ExitStatus) return;
  let toLog = e;
  err("exiting due to exception: " + toLog);
}
if (ENVIRONMENT_IS_NODE) {
  var fs = require("fs");
  var nodePath = require("path");
  if (ENVIRONMENT_IS_WORKER) {
    scriptDirectory = nodePath.dirname(scriptDirectory) + "/";
  } else {
    scriptDirectory = __dirname + "/";
  }
  read_ = (filename, binary) => {
    var ret = tryParseAsDataURI(filename);
    if (ret) {
      return binary ? ret : ret.toString();
    }
    filename = isFileURI(filename)
      ? new URL(filename)
      : nodePath.normalize(filename);
    return fs.readFileSync(filename, binary ? undefined : "utf8");
  };
  readBinary = (filename) => {
    var ret = read_(filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    return ret;
  };
  readAsync = (filename, onload, onerror) => {
    var ret = tryParseAsDataURI(filename);
    if (ret) {
      onload(ret);
    }
    filename = isFileURI(filename)
      ? new URL(filename)
      : nodePath.normalize(filename);
    fs.readFile(filename, function (err, data) {
      if (err) onerror(err);
      else onload(data.buffer);
    });
  };
  if (process["argv"].length > 1) {
    thisProgram = process["argv"][1].replace(/\\/g, "/");
  }
  arguments_ = process["argv"].slice(2);
  if (typeof module != "undefined") {
    module["exports"] = Module;
  }
  process["on"]("uncaughtException", function (ex) {
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });
  process["on"]("unhandledRejection", function (reason) {
    throw reason;
  });
  quit_ = (status, toThrow) => {
    if (keepRuntimeAlive()) {
      process["exitCode"] = status;
      throw toThrow;
    }
    logExceptionOnExit(toThrow);
    process["exit"](status);
  };
  Module["inspect"] = function () {
    return "[Emscripten Module object]";
  };
} else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  if (ENVIRONMENT_IS_WORKER) {
    scriptDirectory = self.location.href;
  } else if (typeof document != "undefined" && document.currentScript) {
    scriptDirectory = document.currentScript.src;
  } else {
    // https://stackoverflow.com/a/42594856
    scriptDirectory = new Error().stack.match(
      /([^ \n])*([a-z]*:\/\/\/?)*?[a-z0-9\/\\]*\.js/gi,
    )[0];
  }
  if (scriptDirectory.indexOf("blob:") !== 0) {
    scriptDirectory = scriptDirectory.substr(
      0,
      scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1,
    );
  } else {
    scriptDirectory = "";
  }
  {
    read_ = (url) => {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, false);
        xhr.send(null);
        return xhr.responseText;
      } catch (err) {
        var data = tryParseAsDataURI(url);
        if (data) {
          return intArrayToString(data);
        }
        throw err;
      }
    };
    if (ENVIRONMENT_IS_WORKER) {
      readBinary = (url) => {
        try {
          var xhr = new XMLHttpRequest();
          xhr.open("GET", url, false);
          xhr.responseType = "arraybuffer";
          xhr.send(null);
          return new Uint8Array(xhr.response);
        } catch (err) {
          var data = tryParseAsDataURI(url);
          if (data) {
            return data;
          }
          throw err;
        }
      };
    }
    readAsync = (url, onload, onerror) => {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.responseType = "arraybuffer";
      xhr.onload = () => {
        if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) {
          onload(xhr.response);
          return;
        }
        var data = tryParseAsDataURI(url);
        if (data) {
          onload(data.buffer);
          return;
        }
        onerror();
      };
      xhr.onerror = onerror;
      xhr.send(null);
    };
  }
  setWindowTitle = (title) => (document.title = title);
} else {
}
if (
  typeof Module["locateFilePackage"] === "function" &&
  !Module["locateFile"]
) {
  Module["locateFile"] = Module["locateFilePackage"];
  err(
    "warning: you defined Module.locateFilePackage, that has been renamed to Module.locateFile (using your locateFilePackage for now)",
  );
}
function locateFile(path) {
  if (Module["locateFile"]) {
    return Module["locateFile"](path, scriptDirectory);
  }
  return scriptDirectory + path;
}
Module.expectedDataFileDownloads++;
(function () {
  if (Module["ENVIRONMENT_IS_PTHREAD"]) return;
  var loadPackage = function (metadata) {
    var PACKAGE_PATH = "";
    if (typeof window === "object") {
      PACKAGE_PATH = window["encodeURIComponent"](
        window.location.pathname
          .toString()
          .substring(0, window.location.pathname.toString().lastIndexOf("/")) +
          "/",
      );
    } else if (
      typeof process === "undefined" &&
      typeof location !== "undefined"
    ) {
      PACKAGE_PATH = encodeURIComponent(
        location.pathname
          .toString()
          .substring(0, location.pathname.toString().lastIndexOf("/")) + "/",
      );
    }
    var PACKAGE_NAME = "js/espeakng.worker.data";
    var REMOTE_PACKAGE_BASE = "espeakng.worker.data";

    var REMOTE_PACKAGE_NAME = locateFile(REMOTE_PACKAGE_BASE);
    var REMOTE_PACKAGE_SIZE = metadata["remote_package_size"];
    function fetchRemotePackage(packageName, packageSize, callback, errback) {
      if (
        typeof process === "object" &&
        typeof process.versions === "object" &&
        typeof process.versions.node === "string"
      ) {
        require("fs").readFile(packageName, function (err, contents) {
          if (err) {
            errback(err);
          } else {
            callback(contents.buffer);
          }
        });
        return;
      }
      var xhr = new XMLHttpRequest();
      xhr.open("GET", packageName, true);
      xhr.responseType = "arraybuffer";
      xhr.onprogress = function (event) {
        var url = packageName;
        var size = packageSize;
        if (event.total) size = event.total;
        if (event.loaded) {
          if (!xhr.addedTotal) {
            xhr.addedTotal = true;
            if (!Module.dataFileDownloads) Module.dataFileDownloads = {};
            Module.dataFileDownloads[url] = {
              loaded: event.loaded,
              total: size,
            };
          } else {
            Module.dataFileDownloads[url].loaded = event.loaded;
          }
          var total = 0;
          var loaded = 0;
          var num = 0;
          for (var download in Module.dataFileDownloads) {
            var data = Module.dataFileDownloads[download];
            total += data.total;
            loaded += data.loaded;
            num++;
          }
          total = Math.ceil((total * Module.expectedDataFileDownloads) / num);
          if (Module["setStatus"])
            Module["setStatus"](
              "Downloading data... (" + loaded + "/" + total + ")",
            );
        } else if (!Module.dataFileDownloads) {
          if (Module["setStatus"]) Module["setStatus"]("Downloading data...");
        }
      };
      xhr.onerror = function (event) {
        throw new Error("NetworkError for: " + packageName);
      };
      xhr.onload = function (event) {
        if (
          xhr.status == 200 ||
          xhr.status == 304 ||
          xhr.status == 206 ||
          (xhr.status == 0 && xhr.response)
        ) {
          var packageData = xhr.response;
          callback(packageData);
        } else {
          throw new Error(xhr.statusText + " : " + xhr.responseURL);
        }
      };
      xhr.send(null);
    }
    function handleError(error) {
      console.error("package error:", error);
    }
    var fetchedCallback = null;
    var fetched = Module["getPreloadedPackage"]
      ? Module["getPreloadedPackage"](REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE)
      : null;
    if (!fetched)
      fetchRemotePackage(
        REMOTE_PACKAGE_NAME,
        REMOTE_PACKAGE_SIZE,
        function (data) {
          if (fetchedCallback) {
            fetchedCallback(data);
            fetchedCallback = null;
          } else {
            fetched = data;
          }
        },
        handleError,
      );
    function runWithFS() {
      function assert(check, msg) {
        if (!check) throw msg + new Error().stack;
      }
      Module["FS_createPath"]("/", "usr", true, true);
      Module["FS_createPath"]("/usr", "share", true, true);
      Module["FS_createPath"]("/usr/share", "espeak-ng-data", true, true);
      Module["FS_createPath"]("/usr/share/espeak-ng-data", "lang", true, true);
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "aav",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "art",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "azc",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "bat",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "bnt",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "ccs",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "cel",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "cus",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "dra",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "esx",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "gmq",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "gmw",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "grk",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "inc",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "ine",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "ira",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "iro",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "itc",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "jpx",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "map",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "miz",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "myn",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "poz",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "roa",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "sai",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "sem",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "sit",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "tai",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "trk",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "urj",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "zle",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "zls",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/lang",
        "zlw",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data",
        "voices",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/voices",
        "!v",
        true,
        true,
      );
      Module["FS_createPath"](
        "/usr/share/espeak-ng-data/voices",
        "mb",
        true,
        true,
      );
      function DataRequest(start, end, audio) {
        this.start = start;
        this.end = end;
        this.audio = audio;
      }
      DataRequest.prototype = {
        requests: {},
        open: function (mode, name) {
          this.name = name;
          this.requests[name] = this;
          Module["addRunDependency"]("fp " + this.name);
        },
        send: function () {},
        onload: function () {
          var byteArray = this.byteArray.subarray(this.start, this.end);
          this.finish(byteArray);
        },
        finish: function (byteArray) {
          var that = this;
          Module["FS_createDataFile"](
            this.name,
            null,
            byteArray,
            true,
            true,
            true,
          );
          Module["removeRunDependency"]("fp " + that.name);
          this.requests[this.name] = null;
        },
      };
      var files = metadata["files"];
      for (var i = 0; i < files.length; ++i) {
        new DataRequest(
          files[i]["start"],
          files[i]["end"],
          files[i]["audio"] || 0,
        ).open("GET", files[i]["filename"]);
      }
      function processPackageData(arrayBuffer) {
        assert(arrayBuffer, "Loading data file failed.");
        assert(
          arrayBuffer.constructor.name === ArrayBuffer.name,
          "bad input to processPackageData",
        );
        var byteArray = new Uint8Array(arrayBuffer);
        DataRequest.prototype.byteArray = byteArray;
        var files = metadata["files"];
        for (var i = 0; i < files.length; ++i) {
          DataRequest.prototype.requests[files[i].filename].onload();
        }
        Module["removeRunDependency"]("datafile_js/espeakng.worker.data");
      }
      Module["addRunDependency"]("datafile_js/espeakng.worker.data");
      if (!Module.preloadResults) Module.preloadResults = {};
      Module.preloadResults[PACKAGE_NAME] = { fromCache: false };
      if (fetched) {
        processPackageData(fetched);
        fetched = null;
      } else {
        fetchedCallback = processPackageData;
      }
    }
    if (Module["calledRun"]) {
      runWithFS();
    } else {
      if (!Module["preRun"]) Module["preRun"] = [];
      Module["preRun"].push(runWithFS);
    }
  };
  loadPackage({
    files: [
      { filename: "/usr/share/espeak-ng-data/en_dict", start: 0, end: 167064 },
      {
        filename: "/usr/share/espeak-ng-data/intonations",
        start: 167064,
        end: 169104,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/aav/vi",
        start: 169104,
        end: 169215,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/aav/vi-VN-x-central",
        start: 169215,
        end: 169358,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/aav/vi-VN-x-south",
        start: 169358,
        end: 169500,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/art/eo",
        start: 169500,
        end: 169541,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/art/ia",
        start: 169541,
        end: 169570,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/art/io",
        start: 169570,
        end: 169620,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/art/jbo",
        start: 169620,
        end: 169689,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/art/lfn",
        start: 169689,
        end: 169824,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/art/piqd",
        start: 169824,
        end: 169880,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/art/py",
        start: 169880,
        end: 170020,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/art/qdb",
        start: 170020,
        end: 170077,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/art/qya",
        start: 170077,
        end: 170250,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/art/sjn",
        start: 170250,
        end: 170425,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/azc/nci",
        start: 170425,
        end: 170539,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/bat/lt",
        start: 170539,
        end: 170567,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/bat/ltg",
        start: 170567,
        end: 170879,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/bat/lv",
        start: 170879,
        end: 171108,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/bnt/sw",
        start: 171108,
        end: 171149,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/bnt/tn",
        start: 171149,
        end: 171191,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/ccs/ka",
        start: 171191,
        end: 171315,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/cel/cy",
        start: 171315,
        end: 171352,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/cel/ga",
        start: 171352,
        end: 171418,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/cel/gd",
        start: 171418,
        end: 171469,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/cus/om",
        start: 171469,
        end: 171508,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/dra/kn",
        start: 171508,
        end: 171563,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/dra/ml",
        start: 171563,
        end: 171620,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/dra/ta",
        start: 171620,
        end: 171671,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/dra/te",
        start: 171671,
        end: 171741,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/esx/kl",
        start: 171741,
        end: 171771,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/eu",
        start: 171771,
        end: 171825,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/gmq/da",
        start: 171825,
        end: 171868,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/gmq/is",
        start: 171868,
        end: 171895,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/gmq/nb",
        start: 171895,
        end: 171982,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/gmq/sv",
        start: 171982,
        end: 172007,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/gmw/af",
        start: 172007,
        end: 172130,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/gmw/de",
        start: 172130,
        end: 172172,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/gmw/en",
        start: 172172,
        end: 172312,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/gmw/en-029",
        start: 172312,
        end: 172647,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/gmw/en-GB-scotland",
        start: 172647,
        end: 172942,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/gmw/en-GB-x-gbclan",
        start: 172942,
        end: 173180,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/gmw/en-GB-x-gbcwmd",
        start: 173180,
        end: 173368,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/gmw/en-GB-x-rp",
        start: 173368,
        end: 173617,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/gmw/en-US",
        start: 173617,
        end: 173874,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/gmw/en-US-nyc",
        start: 173874,
        end: 174145,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/gmw/lb",
        start: 174145,
        end: 174176,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/gmw/nl",
        start: 174176,
        end: 174199,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/grk/el",
        start: 174199,
        end: 174222,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/grk/grc",
        start: 174222,
        end: 174321,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/inc/as",
        start: 174321,
        end: 174363,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/inc/bn",
        start: 174363,
        end: 174388,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/inc/bpy",
        start: 174388,
        end: 174427,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/inc/gu",
        start: 174427,
        end: 174469,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/inc/hi",
        start: 174469,
        end: 174492,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/inc/kok",
        start: 174492,
        end: 174518,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/inc/mr",
        start: 174518,
        end: 174559,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/inc/ne",
        start: 174559,
        end: 174596,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/inc/or",
        start: 174596,
        end: 174635,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/inc/pa",
        start: 174635,
        end: 174660,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/inc/sd",
        start: 174660,
        end: 174726,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/inc/si",
        start: 174726,
        end: 174781,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/inc/ur",
        start: 174781,
        end: 174875,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/ine/hy",
        start: 174875,
        end: 174936,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/ine/hyw",
        start: 174936,
        end: 175301,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/ine/sq",
        start: 175301,
        end: 175404,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/ira/fa",
        start: 175404,
        end: 175494,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/ira/fa-Latn",
        start: 175494,
        end: 175763,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/ira/ku",
        start: 175763,
        end: 175803,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/iro/chr",
        start: 175803,
        end: 176372,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/itc/la",
        start: 176372,
        end: 176669,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/jpx/ja",
        start: 176669,
        end: 176721,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/ko",
        start: 176721,
        end: 176772,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/map/haw",
        start: 176772,
        end: 176814,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/miz/mto",
        start: 176814,
        end: 176997,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/myn/quc",
        start: 176997,
        end: 177207,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/poz/id",
        start: 177207,
        end: 177341,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/poz/mi",
        start: 177341,
        end: 177708,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/poz/ms",
        start: 177708,
        end: 178138,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/qu",
        start: 178138,
        end: 178226,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/roa/an",
        start: 178226,
        end: 178253,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/roa/ca",
        start: 178253,
        end: 178278,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/roa/es",
        start: 178278,
        end: 178341,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/roa/es-419",
        start: 178341,
        end: 178508,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/roa/fr",
        start: 178508,
        end: 178587,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/roa/fr-BE",
        start: 178587,
        end: 178671,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/roa/fr-CH",
        start: 178671,
        end: 178757,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/roa/ht",
        start: 178757,
        end: 178897,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/roa/it",
        start: 178897,
        end: 179006,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/roa/pap",
        start: 179006,
        end: 179068,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/roa/pt",
        start: 179068,
        end: 179163,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/roa/pt-BR",
        start: 179163,
        end: 179272,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/roa/ro",
        start: 179272,
        end: 179298,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/sai/gn",
        start: 179298,
        end: 179345,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/sem/am",
        start: 179345,
        end: 179386,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/sem/ar",
        start: 179386,
        end: 179436,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/sem/he",
        start: 179436,
        end: 179476,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/sem/mt",
        start: 179476,
        end: 179517,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/sem/ti",
        start: 179517,
        end: 179610,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/sit/cmn",
        start: 179610,
        end: 180296,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/sit/cmn-Latn-pinyin",
        start: 180296,
        end: 180457,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/sit/hak",
        start: 180457,
        end: 180585,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/sit/my",
        start: 180585,
        end: 180641,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/sit/yue",
        start: 180641,
        end: 180835,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/sit/yue-Latn-jyutping",
        start: 180835,
        end: 181048,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/tai/shn",
        start: 181048,
        end: 181140,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/tai/th",
        start: 181140,
        end: 181177,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/trk/az",
        start: 181177,
        end: 181222,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/trk/ba",
        start: 181222,
        end: 181247,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/trk/cv",
        start: 181247,
        end: 181287,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/trk/kk",
        start: 181287,
        end: 181327,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/trk/ky",
        start: 181327,
        end: 181370,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/trk/nog",
        start: 181370,
        end: 181409,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/trk/tk",
        start: 181409,
        end: 181434,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/trk/tr",
        start: 181434,
        end: 181459,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/trk/tt",
        start: 181459,
        end: 181482,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/trk/ug",
        start: 181482,
        end: 181506,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/trk/uz",
        start: 181506,
        end: 181545,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/urj/et",
        start: 181545,
        end: 181782,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/urj/fi",
        start: 181782,
        end: 182019,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/urj/hu",
        start: 182019,
        end: 182092,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/urj/smj",
        start: 182092,
        end: 182137,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/zle/be",
        start: 182137,
        end: 182189,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/zle/ru",
        start: 182189,
        end: 182246,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/zle/ru-LV",
        start: 182246,
        end: 182526,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/zle/ru-cl",
        start: 182526,
        end: 182617,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/zle/uk",
        start: 182617,
        end: 182714,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/zls/bg",
        start: 182714,
        end: 182825,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/zls/bs",
        start: 182825,
        end: 183055,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/zls/hr",
        start: 183055,
        end: 183317,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/zls/mk",
        start: 183317,
        end: 183345,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/zls/sl",
        start: 183345,
        end: 183388,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/zls/sr",
        start: 183388,
        end: 183638,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/zlw/cs",
        start: 183638,
        end: 183661,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/zlw/pl",
        start: 183661,
        end: 183699,
      },
      {
        filename: "/usr/share/espeak-ng-data/lang/zlw/sk",
        start: 183699,
        end: 183723,
      },
      {
        filename: "/usr/share/espeak-ng-data/phondata",
        start: 183723,
        end: 734147,
      },
      {
        filename: "/usr/share/espeak-ng-data/phonindex",
        start: 734147,
        end: 773403,
      },
      {
        filename: "/usr/share/espeak-ng-data/phontab",
        start: 773403,
        end: 829491,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/Alex",
        start: 829491,
        end: 829619,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/Alicia",
        start: 829619,
        end: 830093,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/Andrea",
        start: 830093,
        end: 830450,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/Andy",
        start: 830450,
        end: 830770,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/Annie",
        start: 830770,
        end: 831085,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/AnxiousAndy",
        start: 831085,
        end: 831446,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/Demonic",
        start: 831446,
        end: 835304,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/Denis",
        start: 835304,
        end: 835609,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/Diogo",
        start: 835609,
        end: 835988,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/Gene",
        start: 835988,
        end: 836269,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/Gene2",
        start: 836269,
        end: 836552,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/Henrique",
        start: 836552,
        end: 836933,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/Hugo",
        start: 836933,
        end: 837311,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/Jacky",
        start: 837311,
        end: 837578,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/Lee",
        start: 837578,
        end: 837916,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/Marco",
        start: 837916,
        end: 838383,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/Mario",
        start: 838383,
        end: 838653,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/Michael",
        start: 838653,
        end: 838923,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/Mike",
        start: 838923,
        end: 839035,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/Mr serious",
        start: 839035,
        end: 842228,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/Nguyen",
        start: 842228,
        end: 842508,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/Reed",
        start: 842508,
        end: 842710,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/RicishayMax",
        start: 842710,
        end: 842943,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/RicishayMax2",
        start: 842943,
        end: 843378,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/RicishayMax3",
        start: 843378,
        end: 843813,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/Storm",
        start: 843813,
        end: 844233,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/Tweaky",
        start: 844233,
        end: 847422,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/UniRobot",
        start: 847422,
        end: 847839,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/adam",
        start: 847839,
        end: 847914,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/anika",
        start: 847914,
        end: 848407,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/anikaRobot",
        start: 848407,
        end: 848919,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/announcer",
        start: 848919,
        end: 849219,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/antonio",
        start: 849219,
        end: 849600,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/aunty",
        start: 849600,
        end: 849958,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/belinda",
        start: 849958,
        end: 850298,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/benjamin",
        start: 850298,
        end: 850499,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/boris",
        start: 850499,
        end: 850723,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/caleb",
        start: 850723,
        end: 850780,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/croak",
        start: 850780,
        end: 850873,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/david",
        start: 850873,
        end: 850985,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/ed",
        start: 850985,
        end: 851272,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/edward",
        start: 851272,
        end: 851423,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/edward2",
        start: 851423,
        end: 851575,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/f1",
        start: 851575,
        end: 851899,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/f2",
        start: 851899,
        end: 852256,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/f3",
        start: 852256,
        end: 852631,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/f4",
        start: 852631,
        end: 852981,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/f5",
        start: 852981,
        end: 853413,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/fast",
        start: 853413,
        end: 853562,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/grandma",
        start: 853562,
        end: 853825,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/grandpa",
        start: 853825,
        end: 854081,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/gustave",
        start: 854081,
        end: 854334,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/ian",
        start: 854334,
        end: 857502,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/iven",
        start: 857502,
        end: 857763,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/iven2",
        start: 857763,
        end: 858042,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/iven3",
        start: 858042,
        end: 858304,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/iven4",
        start: 858304,
        end: 858565,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/john",
        start: 858565,
        end: 861751,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/kaukovalta",
        start: 861751,
        end: 862112,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/klatt",
        start: 862112,
        end: 862150,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/klatt2",
        start: 862150,
        end: 862188,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/klatt3",
        start: 862188,
        end: 862227,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/klatt4",
        start: 862227,
        end: 862266,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/klatt5",
        start: 862266,
        end: 862305,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/klatt6",
        start: 862305,
        end: 862344,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/linda",
        start: 862344,
        end: 862694,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/m1",
        start: 862694,
        end: 863029,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/m2",
        start: 863029,
        end: 863293,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/m3",
        start: 863293,
        end: 863593,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/m4",
        start: 863593,
        end: 863883,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/m5",
        start: 863883,
        end: 864145,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/m6",
        start: 864145,
        end: 864333,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/m7",
        start: 864333,
        end: 864587,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/m8",
        start: 864587,
        end: 864871,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/marcelo",
        start: 864871,
        end: 865122,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/max",
        start: 865122,
        end: 865347,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/michel",
        start: 865347,
        end: 865751,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/miguel",
        start: 865751,
        end: 866133,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/mike2",
        start: 866133,
        end: 866321,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/norbert",
        start: 866321,
        end: 869510,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/pablo",
        start: 869510,
        end: 872652,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/paul",
        start: 872652,
        end: 872936,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/pedro",
        start: 872936,
        end: 873288,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/quincy",
        start: 873288,
        end: 873642,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/rob",
        start: 873642,
        end: 873907,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/robert",
        start: 873907,
        end: 874181,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/robosoft",
        start: 874181,
        end: 874632,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/robosoft2",
        start: 874632,
        end: 875086,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/robosoft3",
        start: 875086,
        end: 875541,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/robosoft4",
        start: 875541,
        end: 875988,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/robosoft5",
        start: 875988,
        end: 876433,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/robosoft6",
        start: 876433,
        end: 876720,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/robosoft7",
        start: 876720,
        end: 877130,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/robosoft8",
        start: 877130,
        end: 877373,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/sandro",
        start: 877373,
        end: 877903,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/shelby",
        start: 877903,
        end: 878183,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/steph",
        start: 878183,
        end: 878547,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/steph2",
        start: 878547,
        end: 878914,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/steph3",
        start: 878914,
        end: 879291,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/travis",
        start: 879291,
        end: 879674,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/victor",
        start: 879674,
        end: 879927,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/whisper",
        start: 879927,
        end: 880113,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/whisperf",
        start: 880113,
        end: 880505,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/!v/zac",
        start: 880505,
        end: 880780,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-af1",
        start: 880780,
        end: 880868,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-af1-en",
        start: 880868,
        end: 880951,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-ar1",
        start: 880951,
        end: 881035,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-ar2",
        start: 881035,
        end: 881119,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-br1",
        start: 881119,
        end: 881251,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-br2",
        start: 881251,
        end: 881387,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-br3",
        start: 881387,
        end: 881519,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-br4",
        start: 881519,
        end: 881655,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-ca1",
        start: 881655,
        end: 881760,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-ca2",
        start: 881760,
        end: 881865,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-cn1",
        start: 881865,
        end: 881957,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-cr1",
        start: 881957,
        end: 882068,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-cz1",
        start: 882068,
        end: 882138,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-cz2",
        start: 882138,
        end: 882220,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-de1",
        start: 882220,
        end: 882364,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-de1-en",
        start: 882364,
        end: 882460,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-de2",
        start: 882460,
        end: 882588,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-de2-en",
        start: 882588,
        end: 882668,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-de3",
        start: 882668,
        end: 882767,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-de3-en",
        start: 882767,
        end: 882863,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-de4",
        start: 882863,
        end: 882992,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-de4-en",
        start: 882992,
        end: 883073,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-de5",
        start: 883073,
        end: 883309,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-de5-en",
        start: 883309,
        end: 883399,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-de6",
        start: 883399,
        end: 883521,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-de6-en",
        start: 883521,
        end: 883595,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-de6-grc",
        start: 883595,
        end: 883678,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-de7",
        start: 883678,
        end: 883828,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-de8",
        start: 883828,
        end: 883899,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-ee1",
        start: 883899,
        end: 883996,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-en1",
        start: 883996,
        end: 884127,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-es1",
        start: 884127,
        end: 884241,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-es2",
        start: 884241,
        end: 884349,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-es3",
        start: 884349,
        end: 884453,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-es4",
        start: 884453,
        end: 884541,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-fr1",
        start: 884541,
        end: 884707,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-fr1-en",
        start: 884707,
        end: 884811,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-fr2",
        start: 884811,
        end: 884914,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-fr3",
        start: 884914,
        end: 885014,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-fr4",
        start: 885014,
        end: 885141,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-fr4-en",
        start: 885141,
        end: 885248,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-fr5",
        start: 885248,
        end: 885348,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-fr6",
        start: 885348,
        end: 885448,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-fr7",
        start: 885448,
        end: 885531,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-gr1",
        start: 885531,
        end: 885625,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-gr2",
        start: 885625,
        end: 885719,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-gr2-en",
        start: 885719,
        end: 885807,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-hb1",
        start: 885807,
        end: 885875,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-hb2",
        start: 885875,
        end: 885958,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-hu1",
        start: 885958,
        end: 886060,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-hu1-en",
        start: 886060,
        end: 886157,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-ic1",
        start: 886157,
        end: 886245,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-id1",
        start: 886245,
        end: 886346,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-in1",
        start: 886346,
        end: 886415,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-in2",
        start: 886415,
        end: 886500,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-ir1",
        start: 886500,
        end: 887253,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-it1",
        start: 887253,
        end: 887337,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-it2",
        start: 887337,
        end: 887424,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-it3",
        start: 887424,
        end: 887566,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-it4",
        start: 887566,
        end: 887711,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-jp1",
        start: 887711,
        end: 887782,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-jp2",
        start: 887782,
        end: 887883,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-jp3",
        start: 887883,
        end: 887970,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-la1",
        start: 887970,
        end: 888053,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-lt1",
        start: 888053,
        end: 888140,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-lt2",
        start: 888140,
        end: 888227,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-ma1",
        start: 888227,
        end: 888325,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-mx1",
        start: 888325,
        end: 888445,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-mx2",
        start: 888445,
        end: 888565,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-nl1",
        start: 888565,
        end: 888634,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-nl2",
        start: 888634,
        end: 888730,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-nl2-en",
        start: 888730,
        end: 888821,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-nl3",
        start: 888821,
        end: 888906,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-nz1",
        start: 888906,
        end: 888974,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-pl1",
        start: 888974,
        end: 889073,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-pl1-en",
        start: 889073,
        end: 889155,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-pt1",
        start: 889155,
        end: 889286,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-ro1",
        start: 889286,
        end: 889373,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-ro1-en",
        start: 889373,
        end: 889454,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-sw1",
        start: 889454,
        end: 889552,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-sw1-en",
        start: 889552,
        end: 889645,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-sw2",
        start: 889645,
        end: 889747,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-sw2-en",
        start: 889747,
        end: 889846,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-tl1",
        start: 889846,
        end: 889931,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-tr1",
        start: 889931,
        end: 890016,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-tr2",
        start: 890016,
        end: 890130,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-us1",
        start: 890130,
        end: 890300,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-us2",
        start: 890300,
        end: 890478,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-us3",
        start: 890478,
        end: 890658,
      },
      {
        filename: "/usr/share/espeak-ng-data/voices/mb/mb-vz1",
        start: 890658,
        end: 890802,
      },
    ],
    remote_package_size: 890802,
  });
})();
var moduleOverrides = Object.assign({}, Module);
var arguments_ = [];
var thisProgram = "./this.program";
var quit_ = (status, toThrow) => {
  throw toThrow;
};
var out = Module["print"] || console.log.bind(console);
var err = Module["printErr"] || console.warn.bind(console);
Object.assign(Module, moduleOverrides);
moduleOverrides = null;
if (Module["arguments"]) arguments_ = Module["arguments"];
if (Module["thisProgram"]) thisProgram = Module["thisProgram"];
if (Module["quit"]) quit_ = Module["quit"];
var wasmBinary;
if (Module["wasmBinary"]) wasmBinary = Module["wasmBinary"];
var noExitRuntime = Module["noExitRuntime"] || true;
var WebAssembly = {
  Memory: function (opts) {
    this.buffer = new ArrayBuffer(opts["initial"] * 65536);
  },
  Module: function (binary) {},
  Instance: function (module, info) {
    // prettier-ignore
    this.exports = (
      // EMSCRIPTEN_START_ASM
      function instantiate(za){function e(f){f.grow=function(b){var a=this.length;this.length=this.length+b;return a};f.set=function(c,d){this[c]=d};f.get=function(c){return this[c]};return f}var g;var h=new Uint8Array(123);for(var c=25;c>=0;--c){h[48+c]=52+c;h[65+c]=c;h[97+c]=26+c}h[43]=62;h[47]=63;function n(o,p,q){var i,j,c=0,k=p,l=q.length,m=p+(l*3>>2)-(q[l-2]=="=")-(q[l-1]=="=");for(;c<l;c+=4){i=h[q.charCodeAt(c+1)];j=h[q.charCodeAt(c+2)];o[k++]=h[q.charCodeAt(c)]<<2|i>>4;if(k<m)o[k++]=i<<4|j>>2;if(k<m)o[k++]=j<<6|h[q.charCodeAt(c+3)]}}function r(s){n(g,1024,"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");n(g,45536,"HhYWFhgWFhYXExYaFhIWFg4ODg4ODg4ODg4WFhoaGhYWCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoXFhMZERkGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBhcaExo=");n(g,45664,"HhYYGBgYGxYZGwgVGgEbGRsaEBAZBhYWGRAIFBAQEBYKCgoKCgoKCgoKCgoKCgoKCgoKCgoKChoKCgoKCgoKBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGGgYGBgYGBgYGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYGCgYKBgoGCgYKBgoGCgYKBgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgoGCgYKBgYGCgoGCgYKCgYKCgoGBgoKCgoGCgoGCgoKBgYGCgoGCgoGCgYKBgoKBgoGBgoGCgoGCgoKBgoGCgoGBggKBgYGCAgICAoJBgoJBgoJBgoGCgYKBgoGCgYKBgoGCgYGCgYKBgoGCgYKBgoGCgYKBgoGBgoJBgoGCgoKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYGBgYGBgYKCgYKCgYGCgYKCgoKBgoGCgYKBgoGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYIBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBwcHBwcHBwcHBwcHBwcHBwcHGRkZGQcHBwcHBwcHBwcHBxkZGRkZGRkZGRkZGRkZBwcHBwcZGRkZGRkZBxkHGRkZGRkZGRkZGRkZGRkZGRkNDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NCgYKBgcZCgYCAgcGBgYWCgICAgIZGQoWCgoKAgoCCgoGCgoKCgoKCgoKCgoKCgoKCgoCCgoKCgoKCgoKBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYKBgYKCgoGBgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYGBgYGCgYaCgYKCgYGCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBhsNDQ0NDQwMCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgoGCgYKBgoGCgYKBgoGBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgIKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgICBxYWFhYWFgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGFhICAhsbGAINDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0SDRYNDRYNDRYNAgICAgICAgIICAgICAgICAgICAgICAgICAgICAgICAgICAgCAgICCAgICBYWAgICAgICAgICAgIBAQEBAQEaGhoWFhgWFhsbDQ0NDQ0NDQ0NDQ0WAQIWFggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIBwgICAgICAgICAgNDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0ODg4ODg4ODg4OFhYWFggIDQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBYIDQ0NDQ0NDQEbDQ0NDQ0NBwcNDRsNDQ0NCAgODg4ODg4ODg4OCAgIGxsIFhYWFhYWFhYWFhYWFhYCAQgNCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NAgIICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA0NDQ0NDQ0NDQ0NCAICAgICAgICAgICAgICDg4ODg4ODg4ODggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA0NDQ0NDQ0NDQcHGxYWFgcCAg0YGAgICAgICAgICAgICAgICAgICAgICAgNDQ0NBw0NDQ0NDQ0NDQcNDQ0HDQ0NDQ0CAhYWFhYWFhYWFhYWFhYWFgIICAgICAgICAgICAgICAgICAgICAgICAgIDQ0NAgIWAggICAgICAgICAgIAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIICAgICAgICAgICAgICAgICAgICAgCCAgICAgICAgCAgICAgICAgICAgICAgICAgICAgINDQ0NDQ0NDQ0NDQ0NDQ0BDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0LCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDQsNCAsLCw0NDQ0NDQ0NCwsLCw0LCwgNDQ0NDQ0NCAgICAgICAgICA0NFhYODg4ODg4ODg4OFgcICAgICAgICAgICAgICAgNCwsCCAgICAgICAgCAggIAgIICAgICAgICAgICAgICAgICAgICAgIAggICAgICAgCCAICAggICAgCAg0ICwsLDQ0NDQICCwsCAgsLDQgCAgICAgICAgsCAgICCAgCCAgIDQ0CAg4ODg4ODg4ODg4ICBgYEBAQEBAQGxgIFg0CAg0NCwIICAgICAgCAgICCAgCAggICAgICAgICAgICAgICAgICAgICAgCCAgICAgICAIICAIICAIICAICDQILCwsNDQICAgINDQICDQ0NAgICDQICAgICAgIICAgIAggCAgICAgICDg4ODg4ODg4ODg0NCAgIDRYCAgICAgICAgICDQ0LAggICAgICAgICAIICAgCCAgICAgICAgICAgICAgICAgICAgICAIICAgICAgIAggIAggICAgIAgINCAsLCw0NDQ0NAg0NCwILCw0CAggCAgICAgICAgICAgICAgIICA0NAgIODg4ODg4ODg4OFhgCAgICAgICCA0NDQ0NDQINCwsCCAgICAgICAgCAggIAgIICAgICAgICAgICAgICAgICAgICAgIAggICAgICAgCCAgCCAgICAgCAg0ICw0LDQ0NDQICCwsCAgsLDQICAgICAgICDQsCAgICCAgCCAgIDQ0CAg4ODg4ODg4ODg4bCBAQEBAQEAICAgICAgICAgINCAIICAgICAgCAgIICAgCCAgICAICAggIAggCCAgCAgIICAICAggICAICAggICAgICAgICAgICAICAgILCw0LCwICAgsLCwILCwsNAgIIAgICAgICCwICAgICAgICAgICAgICDg4ODg4ODg4ODhAQEBsbGxsbGxgbAgICAgINCwsLDQgICAgICAgIAggICAIICAgICAgICAgICAgICAgICAgICAgICAIICAgICAgICAgICAgICAgIAgICCA0NDQsLCwsCDQ0NAg0NDQ0CAgICAgICDQ0CCAgIAgICAgIICA0NAgIODg4ODg4ODg4OAgICAgICAgIQEBAQEBAQGwgNCwsWCAgICAgICAgCCAgIAggICAgICAgICAgICAgICAgICAgICAgIAggICAgICAgICAgCCAgICAgCAg0ICw0LCwsLCwINCwsCCwsNDQICAgICAgILCwICAgICAgIIAggIDQ0CAg4ODg4ODg4ODg4CCAgCAgICAgICAgICAgICDQ0LCwIICAgICAgICAIICAgCCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgNDQgLCwsNDQ0NAgsLCwILCwsNCBsCAgICCAgICxAQEBAQEBAICAgNDQICDg4ODg4ODg4ODhAQEBAQEBAQEBsICAgICAgCAgsLAggICAgICAgICAgICAgICAgICAICAggICAgICAgICAgICAgICAgICAgICAgICAIICAgICAgICAgCCAICCAgICAgICAICAg0CAgICCwsLDQ0NAg0CCwsLCwsLCwsCAgICAgIODg4ODg4ODg4OAgILCxYCAgICAgICAgICAgIICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgNCAgNDQ0NDQ0NAgICAhgICAgICAgHDQ0NDQ0NDQ0WDg4ODg4ODg4ODhYWAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAggIAggCAggIAggCAggCAgICAgIICAgIAggICAgICAgCCAgIAggCCAICCAgCCAgICA0ICA0NDQ0NDQINDQgCAggICAgIAgcCDQ0NDQ0NAgIODg4ODg4ODg4OAgIICAgIAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIIGxsbFhYWFhYWFhYWFhYWFhYWGxYbGxsNDRsbGxsbGw4ODg4ODg4ODg4QEBAQEBAQEBAQGw0bDRsNFxMXEwsLCAgICAgICAgCCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAgICAg0NDQ0NDQ0NDQ0NDQ0NCw0NDQ0NFg0NCAgICAgNDQ0NDQ0NDQ0NDQINDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0CGxsbGxsbGxsNGxsbGxsbAhsbFhYWFhYbGxsbFhYCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAsLDQ0NDQsNDQ0NDQ0LDQ0LCw0NCA4ODg4ODg4ODg4WFhYWFhYICAgICAgLCw0NCAgICA0NDQgLCwsICAsLCwsLCwsICAgNDQ0NCAgICAgICAgICAgICA0LCw0NCwsLCwsLDQgLDg4ODg4ODg4ODgsLCw0bGwoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKAgoCAgICAgoCAgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYWBwYGBggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAggICAgCAggICAgICAgCCAIICAgIAgIICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAIICAgIAgIICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCCAgICAICCAgICAgICAIIAggICAgCAggICAgICAgICAgICAgICAIICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCCAgICAICCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAICDQ0NFhYWFhYWFhYWEBAQEBAQEBAQEBAQEBAQEBAQEBACAgIICAgICAgICAgICAgICAgIGxsbGxsbGxsbGwICAgICAgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKAgIGBgYGBgYCAhIICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFhYICAgICAgICAgICAgICAgICB4ICAgICAgICAgICAgICAgICAgICAgICAgICBcTAgICCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFhYWDw8PCAgICAgICAgCAgICAgICCAgICAgICAgICAgICAIICAgIDQ0NAgICAgICAgICAgIICAgICAgICAgICAgICAgICAgNDQ0WFgICAgICAgICAggICAgICAgICAgICAgICAgICA0NAgICAgICAgICAgICCAgICAgICAgICAgICAIICAgCDQ0CAgICAgICAgICAgIICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDQ0LDQ0NDQ0NDQsLCwsLCwsLDQsLDQ0NDQ0NDQ0NDQ0WFhYHFhYWGAgNAgIODg4ODg4ODg4OAgICAgICEBAQEBAQEBAQEAICAgICAhYWFhYWFhIWFhYWDQ0NAQIODg4ODg4ODg4OAgICAgICCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgHCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCAgICAgICCAgICAgNDQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgNCAICAgICCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAICAgICAgICAgIICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAg0NDQsLCwsNDQsLCwICAgILCw0LCwsLCwsNDQ0CAgICGwICAhYWDg4ODg4ODg4ODggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAICCAgICAgCAgICAgICAgICAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAgICAggICAgICAgICAgICAgICAgICAgICAgICAgIAgICAgICDg4ODg4ODg4ODhACAgIbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbCAgICAgICAgICAgICAgICAgICAgICAgNDQsLDQICFhYICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAsNCw0NDQ0NDQ0CDQsNCwsNDQ0NDQ0NDQsLCwsLCw0NDQ0NDQ0NDQ0CAg0ODg4ODg4ODg4OAgICAgICDg4ODg4ODg4ODgICAgICAhYWFhYWFhYHFhYWFhYWAgINDQ0NDQ0NDQ0NDQ0NDQwCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg0NDQ0LCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgNCw0NDQ0NCw0LCwsLCw0LCwgICAgICAgCAgICDg4ODg4ODg4ODhYWFhYWFhYbGxsbGxsbGxsbDQ0NDQ0NDQ0NGxsbGxsbGxsbAgICDQ0LCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICw0NDQ0LCw0NCw0NDQgIDg4ODg4ODg4ODggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDQsNDQsLCw0LDQ0NCwsCAgICAgICAhYWFhYICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLCwsLCwsLCw0NDQ0NDQ0NCwsNDQICAhYWFhYWDg4ODg4ODg4ODgICAggICA4ODg4ODg4ODg4ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgHBwcHBwcWFgYGBgYGBgYGBgICAgICAgIKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKAgIKCgoWFhYWFhYWFgICAgICAgICDQ0NFg0NDQ0NDQ0NDQ0NDQ0LDQ0NDQ0NDQgICAgNCAgICAsLDQgICw0NAgICAgICBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcGBgYGBgYGBgYGBgYGBwYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQINDQ0NDQoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgYGBgYGBgYGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYGBgYGBgYGBgoKCgoKCgoKBgYGBgYGAgIKCgoKCgoCAgYGBgYGBgYGCgoKCgoKCgoGBgYGBgYGBgoKCgoKCgoKBgYGBgYGAgIKCgoKCgoCAgYGBgYGBgYGAgoCCgIKAgoGBgYGBgYGBgoKCgoKCgoKBgYGBgYGBgYGBgYGBgYCAgYGBgYGBgYGCQkJCQkJCQkGBgYGBgYGBgkJCQkJCQkJBgYGBgYGBgYJCQkJCQkJCQYGBgYGAgYGCgoKCgkZBhkZGQYGBgIGBgoKCgoJGRkZBgYGBgICBgYKCgoKAhkZGQYGBgYGBgYGCgoKCgoZGRkCAgYGBgIGBgoKCgoJGRkCHh4eHh4eHh4eHh4BAQEBARISEhISEhYWFRQXFRUUFxUWFhYWFhYWFhwdAQEBAQEeFhYWFhYWFhYWFRQWFhYWEREWFhYaFxMWFhYWFhYWFhYWFhoWERYWFhYWFhYWFhYeAQEBAQECAQEBAQEBAQEBARAHAgIQEBAQEBAaGhoXEwcQEBAQEBAQEBAQGhoaFxMCBwcHBwcHBwcHBwcHBwICAhgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYAgICAgICAgICAgICAgICAg0NDQ0NDQ0NDQ0NDQ0MDAwMDQwMDA0NDQ0NDQ0NDQ0NDQICAgICAgICAgICAgICAhsbChsbGxsKGxsGCgoKBgYKCgoGGwobGxoKCgoKChsbGxsbGwobChsKGwoKCgobBgoKCgoGCAgICAYbGwYGCgoaGhoaGgoGBgYGGxobGwYbEBAQEBAQEBAQEBAQEBAQEA8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PCgYPDw8PEBsbAgICAhoaGhoaGxsbGxsaGhsbGxsaGxsaGxsaGxsbGxsbGxobGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGhobGxobGhsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGxsbGxsbGxsXExcTGxsbGxsbGxsbGxsbGxsbGxsbGxsaGhsbGxsbGxsXExsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxobGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxoaGhoaGhsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGwICAgICAgICAgICAgICAgICAgICAgICAgIbGxsbGxsbGxsbGwICAgICAgICAgICAgICAgICAgICAhAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxAQEBAQEBAQEBAQEBAQEBAQEBAQEBAbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsaGxsbGxsbGxsbGhsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxoaGhoaGhoaGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGhsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbFxMXExcTFxMXExcTFxMQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxoaGhoaFxMaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaFxMXExcTFxMXExoaGhoaGhoaGhoaGhoaGhobGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoXExcTFxMXExcTFxMXExcTFxMXExcTGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaFxMXExoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaFxMaGhsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxoaGhoaGhoaGhoaGhoaGhoaGhoaGhsbGhoaGhoaGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbAgIbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGwICGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGwIbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGwIKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgIGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgIKBgoKCgYGCgYKBgoGCgoKCgYKBgYKBgYGBgYGBwcKCgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYGGxsbGxsbCgYKBg0NDQoGAgICAgIWFhYWEBYWBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYCBgICAgICBgICCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCAgICAgICBxYCAgICAgICAgICAgICAg0ICAgICAgICAgICAgICAgICAgICAgICAICAgICAgICAggICAgICAgCCAgICAgICAIICAgICAgIAggICAgICAgCCAgICAgICAIICAgICAgIAggICAgICAgCCAgICAgICAINDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDRYWFRQVFBYWFhUUFhUUFhYWFhYWFhYWEhYWEhYVFBYWFRQXExcTFxMXExYWFhYWBxYWFhYWFhYWFhYSEhYWFhYSFhcWFhYWFhYWFhYWFhYCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsCGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsCAgICAgICAgICAgIbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbAgICAgICAgICAgICAgICAgICAgICAgICAgIbGxsbGxsbGxsbGxsCAgICHhYWFhsHCA8XExcTFxMXExcTGxsXExcTFxMXExIXExMbDw8PDw8PDw8PDQ0NDQsLEgcHBwcHGxsPDw8HCBYbGwIICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAICDQ0ZGQcHCBIICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgWBwcHCAICAgICCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAIICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAhsbEBAQEBsbGxsbGxsbGxsICAgICAgICAgICAgICAgICAgICAgICAgICAgCAgICAhsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGwICAgICAgICAgICAggICAgICAgICAgICAgICAgbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbAhAQEBAQEBAQEBAbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsQEBAQEBAQEBsQEBAQEBAQEBAQEBAQEBAbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxAQEBAQEBAQEBAbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsQEBAQEBAQEBAQEBAQEBAbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsCCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCAgICAgICAgICGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAICAgICAgICAgICAgICAgIICAgICAgICAgICAgICAgICAgICAgHCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAgICGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGwICAgICAgICAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgHBwcHBwcWFggICAgICAgICAgICAcWFhYICAgICAgICAgICAgICAgIDg4ODg4ODg4ODggIAgICAgICAgICAgICAgICAgICAgIKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCA0MDAwWDQ0NDQ0NDQ0NDRYHCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgcHDQ0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDw8PDw8PDw8PDw0NFhYWFhYWAgICAgICAgIZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGQcHBwcHBwcHBxkZCgYKBgoGCgYKBgoGCgYGBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoGBwYGBgYGBgYGCgYKBgoKBgoGCgYKBgoGBxkZCgYKBggKBgoGBgYKBgoGCgYKBgoGCgYKBgoGCgYKBgoKCgoKBgoKCgoKBgoGCgYCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICCAcHBggICAgICAgNCAgIDQgICAgNCAgICAgICAgICAgICAgICAgICAgICAgLCw0NCxsbGxsCAgICEBAQEBAQGxsYGwICAgICAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgWFhYWAgICAgICAgILCwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICwsLCwsLCwsLCwsLCwsLCw0NAgICAgICAgIWFg4ODg4ODg4ODg4CAgICAgINDQ0NDQ0NDQ0NDQ0NDQ0NDQ0ICAgICAgWFhYIFggIDQ4ODg4ODg4ODg4ICAgICAgICAgICAgICAgICAgICAgICAgICAgIDQ0NDQ0NDQ0WFggICAgICAgICAgICAgICAgICAgICAgIDQ0NDQ0NDQ0NDQ0LCwICAgICAgICAgICFggICAgICAgICAgICAgICAgICAgICAgICAgICAgIAgICDQ0NCwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDQsLDQ0NDQsLDQsLCwsWFhYWFhYWFhYWFhYWAgcODg4ODg4ODg4OAgICAhYWCAgICAgNBwgICAgICAgICA4ODg4ODg4ODg4ICAgICAIICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA0NDQ0NDQsLDQ0LCw0NAgICAgICAgICCAgIDQgICAgICAgIDQsCAg4ODg4ODg4ODg4CAhYWFhYICAgICAgICAgICAgICAgIBwgICAgICBsbGwgLDQsICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA0IDQ0NCAgNDQgICAgIDQ0IDQgCAgICAgICAgICAgICAgICAgICAgICAgIICAcWFggICAgICAgICAgICw0NCwsWFggHBwsNAgICAgICAgICAggICAgICAICCAgICAgIAgIICAgICAgCAgICAgICAgIICAgICAgIAggICAgICAgCBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBhkHBwcHBgYGBgYGAgICAgICAgICAgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLCw0LCw0LCxYLDQICDg4ODg4ODg4ODgICAgICAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAgICAgICAgICAgICCAgICAgICAgICAgICAgICAgICAgICAgCAgICCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAICAgIDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYGBgYGBgYCAgICAgICAgICAgIGBgYGBgICAgICCA0ICAgICAgICAgIGggICAgICAgICAgICAgCCAgICAgCCAIICAIICAIICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGRkZGRkZGRkZGRkZGRkZAgICAgICAgICAgICAgICAgIICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBMXAgICAgICAgICAgICAgICAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIICAgICAgICAgICAgYGwICDQ0NDQ0NDQ0NDQ0NDQ0NDRYWFhYWFhYXExYCAgICAgINDQ0NDQ0NDQ0NDQ0NDQ0NFhISEREXExcTFxMXExcTFxMXExcTFhYXExYWFhYREREWFhYCFhYWFhIXExcTFxMWFhYaEhoaGgIWGBYWAgICAggICAgIAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAICAQIWFhYYFhYWFxMWGhYSFhYODg4ODg4ODg4OFhYaGhoWFgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKFxYTGREZBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYXGhMaFxMWFxMWFggICAgICAgICAgHCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIBwcICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAgICCAgICAgIAgIICAgICAgCAggICAgICAICCAgIAgICGBgaGRsYGAIbGhoaGhsbAgICAgICAgICAgEBARsbAgIICAgICAgICAgICAgCCAgICAgICAgICAgICAgICAgICAgICAgICAgCCAgICAgICAgICAgICAgICAgICAIICAIICAgICAgICAgICAgICAgCAggICAgICAgICAgICAgIAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAICAgICFhYWAgICAhAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAICAhsbGxsbGxsbGw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PEBAQEBsbGxsbGxsbGxsbGxsbGxsbEBAbGxsCGxsbGxsbGxsbGxsbAgICAhsCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAhsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGw0CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCAgIICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAgICAgICAgICAgICAgICDRAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAICAgIICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBAQEBACAgICAgICAgIICAgICAgICAgICAgICAgICAgICA8ICAgICAgICA8CAgICAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDQ0NDQ0CAgICAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAIWCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAgICAggICAgICAgIFg8PDw8PAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCAg4ODg4ODg4ODg4CAgICAgIKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoCAgICBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGAgICAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCAgICAgICAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCAgICAgICAgICAhYCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAgICAgICAgICCAgICAgICAgICAgICAgICAgICAgICAICAgICAgICAgIICAgICAgICAICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICCAgICAgIAgIIAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAggIAgICCAICCAgICAgICAgICAgICAgICAgICAgICAgCFhAQEBAQEBAQCAgICAgICAgICAgICAgICAgICAgICAgbGxAQEBAQEBAICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAgICAgICAgIQEBAQEBAQEBACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIICAgICAgICAgICAgICAgICAgIAggIAgICAgIQEBAQEAgICAgICAgICAgICAgICAgICAgICAgQEBAQEBACAgIWCAgICAgICAgICAgICAgICAgICAgICAgICAgCAgICAhYCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCAgICEBAICBAQEBAQEBAQEBAQEBAQEBACAhAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAIDQ0NAg0NAgICAgINDQ0NCAgICAIICAgCCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCAg0NDQICAgINEBAQEBAQEBAQAgICAgICAhYWFhYWFhYWFgICAgICAgIICAgICAgICAgICAgICAgICAgICAgICAgICAgICBAQFggICAgICAgICAgICAgICAgICAgICAgICAgICAgIEBAQAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIICAgICAgICBsICAgICAgICAgICAgICAgICAgICAgICAgICAgIDQ0CAgICEBAQEBAWFhYWFhYWAgICAgICAgICCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAgICFhYWFhYWFggICAgICAgICAgICAgICAgICAgICAgCAhAQEBAQEBAQCAgICAgICAgICAgICAgICAgICAICAgICEBAQEBAQEBAICAgICAgICAgICAgICAgICAgCAgICAgICFhYWFgICAgICAgICAgICAhAQEBAQEBACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKAgICAgICAgICAgICAgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgICAgICAgIQEBAQEBAICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgNDQ0NAgICAgICAgIODg4ODg4ODg4OAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAggICAgICAgICAgICAgICAgICAgICAgICAgICAgIEBAQEBAQEBAQEAgCAgICAgICAggICAgICAgICAgICAgICAgICAgICAgNDQ0NDQ0NDQ0NDRAQEBAWFhYWFgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgILDQsICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA0NDQ0NDQ0NDQ0NDQ0NDRYWFhYWFhYCAgICEBAQEBAQEBAQEBAQEBAQEBAQEBAODg4ODg4ODg4OAgICAgICAgICAgICAgICDQ0NCwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAsLCw0NDQ0LCw0NFhYBFhYWFgICAgICAgICAgICAQICCAgICAgICAgICAgICAgICAgICAgICAgICAICAgICAgIODg4ODg4ODg4OAgICAgICDQ0NCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDQ0NDQ0LDQ0NDQ0NDQ0CDg4ODg4ODg4ODhYWFhYICwsCAgICAgICAgIICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA0WFggCAgICAgICAgINDQsICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLCwsNDQ0NDQ0NDQ0LCwgICAgWFhYWDQ0NDRYCAg4ODg4ODg4ODg4IFggWFhYCEBAQEBAQEBAQEBAQEBAQEBAQEBACAgICAgICAgICAggICAgICAgICAgICAgICAgICAIICAgICAgICAgICAgICAgICAgICAgICAgICwsLDQ0NCwsNCw0NFhYWFhYWDQICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICCAgICAgICAIIAggICAgCCAgICAgICAgICAgICAgIAggICAgICAgICAgWAgICAgICCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgNCwsLDQ0NDQ0NDQ0CAgICAg4ODg4ODg4ODg4CAgICAgINDQsLAggICAgICAgIAgIICAICCAgICAgICAgICAgICAgICAgICAgICAIICAgICAgIAggIAggICAgIAg0NCAsLDQsLCwsCAgsLAgILCwsCAggCAgICAgILAgICAgIICAgICAsLAgINDQ0NDQ0NAgICDQ0NDQ0CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLCwsNDQ0NDQ0NDQsLDQ0NCw0ICAgIFhYWFhYODg4ODg4ODg4OAhYCFg0CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLCwsNDQ0NDQ0LDQsLCwsNDQsNDQgIFggCAgICAgICAg4ODg4ODg4ODg4CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLCwsNDQ0NAgILCwsLDQ0LDQ0WFhYWFhYWFhYWFhYWFhYWFhYWFhYWFggICAgNDQICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLCwsNDQ0NDQ0NDQsLDQsNDRYWFggCAgICAgICAgICAg4ODg4ODg4ODg4CAgICAgIWFhYWFhYWFhYWFhYWAgICAgICAgICAgICAgICAgICAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgNCw0LCw0NDQ0NDQsNAgICAgICAgIODg4ODg4ODg4OAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICCAgICAgICAgICAgICAgICAgICAgICAgICAgIAgINDQ0LCw0NDQ0LDQ0NDQ0CAgICDg4ODg4ODg4ODhAQFhYWGwICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICwsLDQ0NDQ0NDQ0NCw0NFgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGDg4ODg4ODg4ODhAQEBAQEBAQEAICAgICAgICAgICAggCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICCA0NDQ0NDQ0NDQ0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDQ0NDQ0NCwgNDQ0NFhYWFhYWFhYNAgICAgICAgIIDQ0NDQ0NCwsNDQ0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAgIICAgIDQ0NDQ0NDQ0NDQ0NDQsNDRYWFggWFhYWFgICAgICAgICAgICAgICAgICAgICAgICAgICAgICCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAgICAgICAggICAgICAgICAIICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICw0NDQ0NDQ0CDQ0NDQ0NCw0IFhYWFhYCAgICAgICAgICDg4ODg4ODg4ODhAQEBAQEBAQEBAQEBAQEBAQEBACAgIWFggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAICDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQILDQ0NDQ0NDQsNDQsNDQICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIICAgICAgIAggIAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDQ0NDQ0NAgICDQINDQINDQ0NDQ0NCA0CAgICAgICAg4ODg4ODg4ODg4CAgICAgIICAgICAgCCAgCCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLCwsLCwINDQILCw0LDQgCAgICAgICDg4ODg4ODg4ODgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIICAgICAgICAgICAgICAgICAgIDQ0LCxYWAgICAgICAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIPDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8CFhYWFhYCAgICAgICAgICAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAgICAgICAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCDg4ODg4ODg4ODgICAgIWFgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAICDQ0NDQ0WAgICAgICAgICAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA0NDQ0NDQ0WFhYWFhsbGxsHBwcHFhsCAgICAgICAgICDg4ODg4ODg4ODgIQEBAQEBAQAggICAgICAgICAgICAgICAgICAgICAICAgICCAgICAgICAgICAgICAgICAgICAICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBhAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQFhYWFgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAgICAgICAgICAgIICwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwICAgICAgICAgICAgICAgINDQ0NBwcHBwcHBwcHBwcHBwICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBwICAgICAgICAgICAgICAgICAgICAgICAgICAgICAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAgICAgICAgICAgICAgIICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCAgICAgICAgICAgICCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAICAgIICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAICAgICCAgICAgICAgICAgICAICAggICAgICAgICAICAgICAgIICAgICAgICAgIAgIbDQ0WAQEBAQICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbAgICAgICAgICAhsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGwICGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbCwsNDQ0bGxsLCwsLCwsBAQEBAQEBAQ0NDQ0NDQ0NGxsNDQ0NDQ0NGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbDQ0NDRsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbAgICAgICAgICAgICAgICAgICAgICAgIbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsNDQ0bAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAhAQEBAQEBAQEBAQEBAQEBAQEBAQAgICAgICAgICAgICGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbAgICAgICAgICEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgYGBgYGBgYCBgYGBgYGBgYGBgYGBgYGBgYGCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgoCCgoCAgoCAgoKAgIKCgoKAgoKCgoKCgoKBgYGBgIGAgYGBgYGBgYCBgYGBgYGBgYGBgYKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGCgoCCgoKCgICCgoKCgoKCgoCCgoKCgoKCgIGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgoKAgoKCgoCCgoKCgoCCgICAgoKCgoKCgoCBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgICCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKChoGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGGgYGBgYGBgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoaBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBhoGBgYGBgYKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKGgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYaBgYGBgYGCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKChoGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGGgYGBgYGBgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoaBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBhoGBgYGBgYKBgICDg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NGxsbGw0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NGxsbGxsbGxsNGxsbGxsbGxsbGxsbGxsNGxsWFhYWFgICAgICAgICAgICAgICAg0NDQ0NAg0NDQ0NDQ0NDQ0NDQ0NDQICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICDQ0NDQ0NDQINDQ0NDQ0NDQ0NDQ0NDQ0NDQICDQ0NDQ0NDQINDQINDQ0NDQICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAgIQEBAQEBAQEBANDQ0NDQ0NAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBg0NDQ0NDQ0CAgICAg4ODg4ODg4ODg4CAgICFhYCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBsQEBAYEBAQEAICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAggICAgCCAgICAgICAgICAgICAgICAgICAgICAgICAgIAggIAggCAggCCAgICAgICAgICAIICAgIAggCCAICAgICAggCAgICCAIIAggCCAgIAggIAggCAggCCAIIAggCCAIICAIIAgIICAgIAggICAgICAgCCAgICAIICAgIAggCCAgICAgICAgICAIICAgICAgICAgICAgICAgICAICAgICCAgIAggICAgIAggICAgICAgICAgICAgICAgIAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAhoaAgICAgICAgICAgICAgIbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGwICAgIbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbAgICAgICAgICAgICGxsbGxsbGxsbGxsbGxsbAgIbGxsbGxsbGxsbGxsbGxsCGxsbGxsbGxsbGxsbGxsbAhsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsCAgICAgICAgICEBAQEBAQEBAQEBAQEAICAhsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbAgICAhsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGwICAgICAgICAgICAgIbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGwICAgIbGxsbGxsbGxsCAgICAgICGxsCAgICAgICAgICAgICAhsbGxsbGwICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxkZGRkZGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbAgICAgICAgICAgIbGxsbGxsbGxsbGxsbAgICGxsbGxsbGxsbGwICAgICAhsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbAgICAgICAgICAgICGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIbGxsbGxsbGxsbGxsCAgICGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsCAgICAgICAhsbGxsbGxsbGxsCAgICAgIbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbAgICAgICAgIbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICGxsbGxsbGxsbGxsbAgICAhsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbAhsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsCAhsbGxsCAgIbAhsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGwICAgICAgICAgICAgIbGxsbGxsbGxsbAgICAgICGxsbAgICAgICAgICAgICAhsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGwICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAhsbGxsbGxsbGxsbGxsbAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCAgICAgICAgICAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAICCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCAgICAgICAgICAgICAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAQICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NAgICAgICAgICAgICAgICAoAAAAAAAAAAgAAAAAAAAACAAAAAAAAAAIAAAAAAAAAAgAAAAAAAAACAAAAAAAAAAIAAAAAAAAAAgAAAAAAAAACAAAAAAAAAAIA=");n(g,81428,"ggAAAAAAAAIAAAAAAAAAAgAAAAAAAAAC");n(g,81475,"AgAAAAAAACAAAAAAAAAAIA==");n(g,81506,"IA==");n(g,81522,"IAAAAAAAAAAg");n(g,81618,"IA==");n(g,81634,"IA==");n(g,81650,"IAAAAAAAAAAg");n(g,81682,"IAAAAAAAAAAgAAAAAAAAACAAAAAAAIAAAAAAAAAAgA==");n(g,81728,"gAAAAAAAAACAAAAAAAAAAIA=");n(g,81760,"gAAAAAAAAACA");n(g,81904,"gAAAAAAAAACAAAAAAAAAAIAAAAAAAAAAgAAAAAAAAACAAAAAAAAAAAAU");n(g,81961,"FAAAAAAAAAAU");n(g,81985,"FAAAAAAAAAAE");n(g,82009,"BAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABA=");n(g,82097,"EAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABA=");n(g,82169,"EAAAAAAAAAAQAAAAAAAAABAAAAAAAACA");n(g,82224,"gAAAAAAAAACA");n(g,82272,"gAAAAAAAAACAAAAAAAAAAIAAAAAAAAAAgAAAAAAAAACAAAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABA==");n(g,82353,"BAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABA==");n(g,82393,"BAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAQAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAEAAAAAAAAABAAAAAAAAAABAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABA==");n(g,82625,"BAAAAAAAAAAE");n(g,82649,"BAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAQAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABA==");n(g,83033,"BAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABA==");n(g,83097,"BAAAAAAAAAAE");n(g,83121,"BAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAEAAAAAAAAQAAAEAAAAAFAAAAQAAAAgEAAABAAAAAQQAAAAAAAACBAAAAAAAAAgEAAAAAAAAAAQAAAAAAAAABAAAAQAAAAgEAAAAAAAAAQQAAAAAAAAARAAAAAAAAAAEAAAAAAAAAAQA==");n(g,83288,"QA==");n(g,83303,"AkAAAAAAAAAQQAAAEAAAAIBAAAAAAAAACEA=");n(g,83352,"QAAAAAAAABBAAAAQAAAAgAAg");n(g,83379,"gAAAAABAAACQggAAIEAAAJAAAAAAAAAAgAAAAABAAACQggAAIEAAAJCCAAAgAAAAgAAAAAAAAACAAAAAAAAAAIAAAAAAQAAAkIIAACBAAACQggAAIEAAAJCCAAAgQAAAkAAAAEBAAACQAAAAYEAAAJCCAABgQAAAkIIAACBAAACQggAAIEAAAJCCAAAgQAAAkIIAACBAAACQggAAIAAAAIAAAAAEAAAAAAAAAIAAAAAAAAAACAAAAAAAAAAEAAAAAAAAACAAAAAAAAAAQAAAAAAAAACAAAAAAAAAAIAAAAAAAAAAAkAAAAAAAAAQQAAAEAAAAIBAAAAAAAAABEAAAAAAAAAIAAAAgIIAAAAAAACAgAAAAAAAAIAAAAAAAAAAgIYAAAAAAACAhgAAAAAAAICAAAAAAAAAgIAAAAAAAACAggAAAAAAAICAAAAAAAAAgIAAAAAAAACAgAAAAAAAAICAAAAAAAAAgJIAAACAAACAggAAAIAAAICCAAAAAAAAgIIAAAAAAACAggAAAIAAAICCAAAAAAAAgIIAAAAAAACAggAAAAAAAICAAAAAAAAAgIAAAAAAAACAggAAAAAAAICGAAAAAAAAgIIAAAAAAACAhgAAAAAAAICCAAAAAAAAgIIAAAAAAACAggAAAAAAAICCAAAAAAAAgIAAAAAAAACAggAAAAAAAICAAAAAAAAAgIIAAAAAAACAggAAAAAAAICCAAAAAAAAgIAAAAAAAACAggAAAAAAAICGAAAAAAAAgJIAAAAAAACAhgAAAAAAAICAAAAAAAAAgIAAAAAAAACAhg==");n(g,83999,"IAAAAACCAAAgAAAAAIIAAAAAAAAAggAAAAAAAACGAAAAAAAAAIIAAAAAAAAAggAAAAAAAACCAAAAaW5maW5pdHkALSsgICAwWDB4AHN0ZDo6YmFkX2Nhc3QAJXMlYyVzX2RpY3QAJXMlYyVzJWMlcyVzACVzJWNzb3VuZGljb25zJWMlcwBDb21waWxlIGVycm9yAHN0ZDo6ZXhjZXB0aW9uAHRlcm1pbmF0aW5nAF8wbGFuZwB1bmV4cGVjdGVkX2hhbmRsZXIgdW5leHBlY3RlZGx5IHJldHVybmVkACVkICVkICVkICVkICVkICVkICVkICVkICVkICVkACVzJWMlYwByYgBwaG9udGFiAHJ3YQBYWFhYWFgAR01UAExDX0FMTABFU1BFQUtfREFUQV9QQVRIAEMAQU5TSV9YMy40LTE5NjgAMy4xLjMwACEtLQBQdXJlIHZpcnR1YWwgZnVuY3Rpb24gY2FsbGVkIQAlcwoAZXNwZWFrOiBCYWQgaW50b25hdGlvbiBkYXRhCgAAAQIEBwMGBQAAAABAAAAAAAAAAHBob25pbmRleAAlcyVjJWMlcwAgJXMAc3RkOjpiYWRfZXhjZXB0aW9uAEVtc2NyaXB0ZW4AbmFuAD94bWwAJXMvLi4vcGhzb3VyY2UAc3RkOjpiYWRfdHlwZWlkAHRlcm1pbmF0ZV9oYW5kbGVyIHVuZXhwZWN0ZWRseSByZXR1cm5lZAAlZCAlZCAlZCAlZCAlZCAlZCAlZCAlZAByYgBXcm9uZyB2ZXJzaW9uIG9mIGVzcGVhay1uZy1kYXRhAEkATEFORwBIT01FAEFOU0lfWDMuNC0xOTg2AChudWxsKQBGYWlsZWQgdG8gb3BlbjogJyVzJwBEZWxldGVkIHZpcnR1YWwgZnVuY3Rpb24gY2FsbGVkIQBudW1iZXJzOiBCYWQgb3B0aW9uIG51bWJlciAlZAoAX2NhcABlbXNjcmlwdGVuAFRoZSBGSUZPIGJ1ZmZlciBpcyBmdWxsAGVzcGVhawAlZCAlZCAlZABzdGQ6OmJhZF9hbGxvYwAlYyVzJWMlcyVjAHBob25kYXRhAC91c3Ivc2hhcmUvZXNwZWFrLW5nLWRhdGEAL3RtcC9lc3BlYWtYWFhYWFgATABQU0FSSFRJVllNVUJGAEFTTU8tNzA4AEMuVVRGLTgAICgAJXM6IEJhZCBvcHRpb24gbnVtYmVyICVkCgBVbnN1cHBvcnRlZCBzcGVjdHJhbCBmaWxlIGZvcm1hdC4KAENhbid0IHJlYWQgZGljdGlvbmFyeSBmaWxlOiAnJXMnCgAtMFgrMFggMFgtMHgrMHggMHgAaW50b25hdGlvbnMAcGhvbmVtZXMAJXMgJXMgJXMgJXMgJXMgJXMAZW4AYmFkX2FycmF5X25ld19sZW5ndGgAbm9uZQBUaGUgZXNwZWFrLW5nIGxpYnJhcnkgaGFzIG5vdCBiZWVuIGluaXRpYWxpemVkACVjJWQAUE9TSVgATQBDLlVURi04AEVDTUEtMTE0ACMxAEVtcHR5IF9kaWN0IGZpbGU6ICclcwoAUmVwbGFjZTogJXMgPiAlcwoAICBzdWZmaXggWyVzXQoKACVzL3Bob25lbWVzACVzJXMlcwBicABhbGwAaW5mAENhbm5vdCBpbml0aWFsaXplIHRoZSBhdWRpbyBkZXZpY2UAJXMlY3ZvaWNlcyVjAE4ATlVMTABFQ01BLTExOABVVEYtOAB3YXNtMzIAZXNwZWFrOiBObyBlbnZlbG9wZQoAQmFkIGRhdGE6ICclcycgKCV4IGxlbmd0aD0leCkKAFRoZSBzcGVjaWZpZWQgZXNwZWFrLW5nIHZvaWNlIGRvZXMgbm90IGV4aXN0ACVzJXMAJXMlYyVzAF9jYXAAYmhmAHNvbWUAWwIlc11dAFAASU5GAEVMT1RfOTI4AGVuX1VTLlVURi04AF8jJWQgAENvbXBpbGluZyBwaG9uZW1lIGRhdGE6ICVzCgBGdWxsIGRpY3Rpb25hcnkgaXMgbm90IGluc3RhbGxlZCBmb3IgJyVzJwoAVW5rbm93biB0dW5lICclcycKACU1ZDoJAGR0AG5vAGVuAG5hbgBfcm9tYW4AQ291bGQgbm90IGxvYWQgdGhlIG1icm9sYS5kbGwgZmlsZQAlZCAlZAAlcyVjbGFuZyVjAHJiAFsCX15fJXMgJXMgX15fJXNdXQBTAF8/QQBJQk0zNjcAPyVkIAAlcyVjJXMAJXMvJXMAcgBpY29uAGVuAENvdWxkIG5vdCBsb2FkIHRoZSBzcGVjaWZpZWQgbWJyb2xhIHZvaWNlIGZpbGUAZ2MAWgBOQU4AXz8/ADxzYXktYXMgaW50ZXJwcmV0LWFzPSJ0dHM6Y2hhciI+JiMlZDs8L3NheS1hcz4ASUJNODE5ACogACAgJWQgJXMgICAgAEludmFsaWQgaW5zdHJ1Y3Rpb24gJS40eCBmb3IgcGhvbmVtZSAnJXMnCgAAcGhvbmRhdGEtbWFuaWZlc3QAVGhlIGV2ZW50IGJ1ZmZlciBpcyBmdWxsAHNwZWxsaW5nAF9saWcAY29uZmlnACVzL2VzcGVhay1uZy1kYXRhACVzJXNfAElTQ0lJAGhBAGwnZXRAAC4ALQAoJXMpAAElZEkgACV4AHcAJXNydWxlcy50eHQAKyVzAHIAXy5wAHBpdGNoAFRoZSByZXF1ZXN0ZWQgZnVuY3Rpb25hbGl0eSBoYXMgbm90IGJlZW4gYnVpbHQgaW50byBlc3BlYWstbmcAX3NtYwBDYwBtYgBJU09fNjQ2LmlydjoxOTkxAHYgPD0gdm93ZWxfY291bnQAVGhlIHBob25lbWUgZmlsZSBpcyBub3QgaW4gYSBzdXBwb3J0ZWQgZm9ybWF0AGNoYXJhY3RlcnMAJWMlcyVzJXMAICVzAF90dXIAZW4AQ2YAbmQAJXMgJWQASVNPXzg4NTktMQAjIFRoaXMgZmlsZSBsaXN0cyB0aGUgdHlwZSBvZiBkYXRhIHRoYXQgaGFzIGJlZW4gY29tcGlsZWQgaW50byB0aGUKIyBwaG9uZGF0YSBmaWxlCiMKIyBUaGUgZmlyc3QgY2hhcmFjdGVyIG9mIGEgbGluZSBpbmRpY2F0ZXMgdGhlIHR5cGUgb2YgZGF0YToKIyAgIFMgLSBBIFNQRUNUX1NFUSBzdHJ1Y3R1cmUKIyAgIFcgLSBBIHdhdmVmaWxlIHNlZ21lbnQKIyAgIEUgLSBBbiBlbnZlbG9wZQojCiMgQWRkcmVzcyBpcyB0aGUgZGlzcGxhY2VtZW50IHdpdGhpbiBwaG9uZGF0YSBvZiB0aGlzIGl0ZW0KIwojICBBZGRyZXNzICBEYXRhIGZpbGUKIyAgLS0tLS0tLSAgLS0tLS0tLS0tCgBfcmV2AHZhcmlhbnQAJXNydWxlcwB0dHM6Y2hhcgBzb3VuZGljb24AQ24AX2VsAG5nAHNyYy9saWJlc3BlYWstbmcvZGljdGlvbmFyeS5jAF9zdWIAcGhvbmRhdGEAVGhlIHNwZWN0cmFsIGZpbGUgZG9lcyBub3QgY29udGFpbiBhbnkgZnJhbWUgZGF0YQABKzEwUwBJU09fODg1OS0xOjE5ODcAdHRzOmtleQAlcyVjJXNfZGljdAB0cwBUaGUgcGhvbmVtZSBtYW5pZmVzdCBmaWxlIGRvZXMgbm90IGNvbnRhaW4gYW55IHBob25lbWVzAF8lYyAlcwBfY3lyAF9zdXAAQ28AX2NybAB3YgAgAS0xMFMASVNPXzg4NTktMgAtAFVucHJvbm91bmNhYmxlPyAnJXMnCgBfaHkAcGhvbmluZGV4AF9hY3UAdHRzOmRpZ2l0cwBDcwAgJXMgJWQgJXMAJ2U6agBhcG9zdHJvcGhlAFRoZSBwaG9uZW1lIGZlYXR1cmUgaXMgbm90IHJlY29nbmlzZWQAdEEASVNPXzg4NTktMjoxOTg3AHdiKwBUcmFuc2xhdGUgJyVzJwoAX2JydgBicmFja2V0cwAlY2VuAElpAHRlbGVwaG9uZQBfaGUAVGhlIHRleHQgZW5jb2RpbmcgaXMgbm90IHN1cHBvcnRlZAAlZCAlZABwaG9udGFiAFsCKFgxKShYMSkoWDEpXV0AbkEAYidpOgBJU09fODg1OS0zAFVzaW5nIHBob25lbWV0YWJsZTogJyVzJwoAVW5zcGVjaWZpZWQgZXJyb3IgMHgleAByb290cwBnbHlwaHMAJWMlcwBfYXIATGwAJXMvY29tcGlsZV9wcm9nX2xvZwBicmFja2V0c0Fubm91bmNlZAAlZABfaGFjAF9eXwBzJ2k6AElTT184ODU5LTM6MTk4OABsaXN0AGRpY3RfbWluAGVuAExtAHgtd2VhawBiYXNlAF9jZWQAX3N5YwBkJ2k6AElTT184ODU5LTQAQmFkIHZvaWNlIGF0dHJpYnV0ZTogJXMKAEVycm9yIHByb2Nlc3NpbmcgZmlsZSAnJXMnOiAlcy4KAGxpc3R4AGRpY3RydWxlcwBfY2lyAExvAHdlYWsAX2hpACdpOgBJU09fODg1OS00OjE5ODgAJXMgAEludmFsaWQgcGhvbmVtZSBjb2RlICVkCgAKUmVmcyAlZCwgIFJldXNlZCAlZAoARXJyb3I6ICVzIGF0ICclcycgKGV4cGVjdGVkIDB4JXgsIGdvdCAweCV4KS4KAFVua25vd24gcGhvbmVtZSB0YWJsZTogJyVzJwoATHQAJWMlcwBpbnRvbmF0aW9uAF9ibgBtZWRpdW0AZW1vamkAJ2VmAF9kaWEASVNPXzg4NTktNQBSZXBsYWNlOiAlcyAgJXMKAENvbXBpbGVkIHBob25lbWVzOiAlZCBlcnJvcnMuCgBFcnJvcjogJXMuCgBoc3gATHUAJXMvLi4vcGhzb3VyY2UvaW50b25hdGlvbi50eHQAbF9kaWVyZXNpcwAlcyslcwBfZ3VyAGlvbgBzdHJvbmcAZXh0cmEASVNPXzg4NTktNToxOTg4AF9hYzIAbF9wcmVmaXgAX2d1AF9kb3QAJXMlY3ZvaWNlcwByAHgtc3Ryb25nAE1jAElTT184ODU5LTYAQ29tcGlsaW5nOiAnJXMnCgBfZ3J2AGxfcmVncmVzc2l2ZV92AHJzAF9vcgAlcy8uLi9waHNvdXJjZS9pbnRvbmF0aW9uACVzJWNsYW5nAE1lAHJlZHVjZWQASVNPXzg4NTktNjoxOTg3ACQxAGlyAF9tY24ATW4AbW9kZXJhdGUAdHVuZQBsX3VucHJvbm91bmNhYmxlAF90YQBJU09fODg1OS03ACQyAG1iLwAlcy9pbnRvbmF0aW9ucwB1cgBfb2dvAGxfc29ub3JhbnRfbWluAHJhdGUAX3RlAE5kAElTT184ODU5LTc6MTk4NwAkMwAvLwBfa24ATmwAYXRoAF9ybmcAdm9sdW1lAGFwb3N0cm9waGUAbG93ZXJjYXNlU2VudGVuY2UASVNPXzg4NTktOAAkNABEdXBsaWNhdGUgdHVuZSBuYW1lOiAnJXMnAGJyYWNrZXRzAG51bWJlcnMAbnMATm8AX21sAF9zdGsAcmFuZ2UAQmFkIHR1bmUgbmFtZTogJyVzOwBJU09fODg1OS04OjE5ODgAJDUAc3BlbGxpbmdTdHJlc3MAX3NpAF90bGQAZmllbGQAYnJhY2tldHNBbm5vdW5jZWQAUGMASVNPXzg4NTktOQAkNgBCYWQgZW52ZWxvcGUgbmFtZTogJyVzJwBfYmFyAGRpY3RfbWluAF90aABzcG9uZwBtb2RlAFR1bmUgJyVzJyBub3QgZm91bmQAc3RyZXNzQWRkAFBkAElTT184ODU5LTk6MTk4OQAkNwBfcmZ4ACR1AGRpY3RydWxlcwBzdHJlc3NBbXAAX2xvAHB1bmN0dWF0aW9uAHJhbmcAUGUASVNPXzg4NTktMTAAVW5leHBlY3RlZDogJyVzJwBjYXBpdGFsX2xldHRlcnMAaW50b25hdGlvbgBfaG9rAF90aQBzdHJlc3NMZW5ndGgAbGFyZwBQZgBUdW5lICclcycgbm90IGRlZmluZWQASVNPXzg4NTktMTA6MTk5MgAkdTEAX215AHN0cmVzc09wdABsX2RpZXJlc2lzAF8jJXMAbGV2ZWwAUGkASVNPXzg4NTktMTQAJHUyAGFkZCBlCgBDb21waWxlZCAlZCBpbnRvbmF0aW9uIHR1bmVzOiAlZCBlcnJvcnMuCgBsX3ByZWZpeABhbHBoYWJldABUb28gbWFueSBwaG9uZW1ldGFibGVzAF94IyVzAFBvAHN0cmVzc1J1bGUAX2thAElTT184ODU5LTE0OjE5OTgAJHUzAE91dCBvZiBtZW1vcnkAbF9yZWdyZXNzaXZlX3YAdHVuZXMAUHMAX2tvAHBoAElTT184ODU5LTE1AF8wACR1KwBfZHB0AHdvcmRzAGludGVycHJldC1hcwBfZXRoAGxfdW5wcm9ub3VuY2FibGUAU2MAXwBJU09fODg1OS0xNgAkdTErAEJhZCBydWxlcyBkYXRhIGluICclc19kaWN0JyBhdCAweCV4ICglYykKAGZvcm1hdABsX3Nvbm9yYW50X21pbgBTawBfYnJhaWxsZQBfME0lZABJU09fODg1OS0xNjoyMDAxACR1MisAQ2FuJ3QgZmluZCBiYXNlIHBob25lbWV0YWJsZSAnJXMnACUzZAklcyBbJXNdCgBDYW5ub3Qgc2V0ICVzOiBsYW5ndWFnZSBub3Qgc2V0LCBvciBpcyBpbnZhbGlkLgoAU20AZGV0YWlsAGxvd2VyY2FzZVNlbnRlbmNlAF9qYQBJU082NDYtVVMAXy4AJHUzKwBfAQBudW1iZXJzAFNvAF8lZG4AX3poACRwYXVzZQAlYyVkWQBwaG9uZW1lX2xlbiA8IE5fUEhPTkVNRV9CWVRFUwBJU08tMTA2NDYtVUNTLTIAJQBzcGVsbGluZ1N0cmVzcwBhbGlhcwBabAAkc3RyZW5kAElTTy04ODU5LTEAJSUARmxhZ3M6ICAlcyAgJXMKACVzJXMlYyVzJXMAWnAAbmFtZQBzdHJlc3NBZGQAJHN0cmVuZDIASVNPLTg4NTktMgAsAEZvdW5kOiAnJXMgJXMKAFpzACVzJXMlcyVjJXMARm91bmQ6ICclcwBzdHJlc3NBbXAAJHVuc3RyZXNzZW5kACVjJWRNAElTTy04ODU5LTMALCwAc3RyZXNzTGVuZ3RoACRhY2NlbnRfYmVmb3JlAF8wWiVkAHNyYwBJU08tODg1OS00AC0tACcAJyBbJXNdICAlcwoAJGFiYnJldgBzdHJlc3NPcHQAJXMvJXMAQWRsbQBfJWNkAElTTy04ODU5LTUAJycAJWMlcwBBZmFrAHN0cmVzc1J1bGUAJGRvdWJsZQAlYyVkSQA9AElTTy04ODU5LTYAJGFsdAB0dW5lcwBBZ2hiACVjJWRVAF86AElTTy04ODU5LTcAX2RwdDIA2Y4gINmPICDZkAB3b3JkcwBfJWRNJWRvAEFob20Ac3RyZW5ndGgASVNPLTg4NTktOAAkYWx0MQBfIQDYpyDZiCDZigBuYW1lAF8lZE0lZGUAQXJhYgAlYyVkQgA6AElTTy04ODU5LTkAJGFsdDIA2Kgg2b4g2Kog2Kkg2Ksg2Kwg2K0g2K4g2K8g2LAg2LEg2LIg2LMg2LQg2LUg2LYg2Lcg2Lgg2Lkg2Log2YEg2YIg2YMg2YQg2YUg2YYg2KYg2KQg2KEg2KMg2KIg2KUg2YcAXyVkTSVkeABBcm1pAHRpbWUAbGFuZ3VhZ2UAQAAkYWx0MwBJU08tODg1OS0xMADYtSDYtiDYtyDYuABnZW5kZXIAQXJtbgB4bWw6YmFzZQBfJWRNJWQAJGFsdDQASVNPLTg4NTktMTEAQC0AfHwAJXgAQXZzdAB2YXJpYW50cwBfMG9mACRhbHQ1AElTTy04ODU5LTEzACDZkSAAZm9ybWFudABfJXMlZG8AQmFsaQAlZAAkYWx0NgBJU08tODg1OS0xNAAxAEJhbXUAc3BlYWsAcGl0Y2gAXyVzJWRlACRhbHQ3AElTTy04ODU5LTE1ACNYMQBfJXMlZHgAQmFzcwBwaG9uZW1lcwAkY29tYmluZQB2b2ljZQA/AElTTy04ODU5LTE2AGRpY3Rpb25hcnkAcHJvc29keQAkZG90AEJhdGsAXyVzJWQAS09JOC1SAC0AJGhhc2RvdABzYXktYXMAQmVuZwByZXBsYWNlAF9eXwBMYXRpbi05AF8wTTIAQmhrcwBlY2hvAG1hcmsAJG1heDMAX1gxAF8lZE0xAFRJUy02MjAAX3wAQmxpcwBmbHV0dGVyACRicmsAVVMtQVNDSUkAXzBNMQAkdGV4dAByb3VnaG5lc3MAJXMlcwBwAEJvcG8AXzo6AFVURi04AGNsYXJpdHkAQnJhaAAkdmVyYmYAcGhvbmVtZQAxTUEAY3AzNjcAdCMAQnJhaQAkdmVyYnNmAHRvbmUAc3ViADBNQQBjcDgxOQAnIQBCdWdpAHZvaWNpbmcAJG5vdW5mAHR0czpzdHlsZQBfO18AY3NBU0NJSQAwTUIAYXVkaW8AYnJlYXRoACRwYXN0ZgBCdWhkADFNACNAAGNzSVNPODg1OTEzAGJyZWF0aHcAZW1waGFzaXMAQ2FrbQAkdmVyYgAjYQAwTQBjc0lTTzg4NTkxNABDYW5zAF8wQ28AJG5vdW4AYnJlYWsAI2UAbWJyb2xhAGNzSVNPODg1OTE1ACRwYXN0AGNvbnNvbmFudHMAQ2FyaQAjaQBtZXRhZGF0YQBjc0lTTzg4NTkxNgBfMEMwAGtsYXR0AGJyACNvAENoYW0AJHZlcmJleHRlbmQAXzBDAGNzSVNPTGF0aW4xACN1AENoZXIAJGNhcGl0YWwAbGkAJXMlYyVzJWMAZmFzdF90ZXN0MgBjc0lTT0xhdGluMgBDaXJ0ACRhbGxjYXBzAE1pc3NpbmcgZmlsZTogJXMAXzBhbmQAc3BlZWQAZGQAY3NJU09MYXRpbjMAQ29wdAAkYWNjZW50AG1haW50YWluZXIAXyVkQ28AcGhvbmVtZXRhYmxlIGlzIG1pc3NpbmcAaW1nAGNzSVNPTGF0aW40AENwcnQAc3RhdHVzACRzZW50ZW5jZQB0ZABLZXl3b3JkICdwaG9uZW1lJyBleHBlY3RlZABjc0lTT0xhdGluNQBfJWRDMAAkb25seQBUb28gbWFueSBwcm9jZWR1cmVzAEN5cmwAbWFsZQBfJWRDAGNzSVNPTGF0aW42AGgxACRvbmx5cwBDeXJzACVzJXMlcyVzAGZlbWFsZQBjc0lTT0xhdGluQXJhYmljACUuM2RQAGgyACVzJXMlYyVzACRzdGVtAE1pc3NpbmcgJ2VuZHBob25lbWUnIGJlZm9yZSBlbmQtb2YtZmlsZQAlZCAlZCAlZCAlZCAlZABjc0lTT0xhdGluQ3lyaWxsaWMARGV2YQBoMwBfJWRmeABNb3JlIHRoYW4gb25lIHBob25lbWUgdHlwZTogJXMARG9ncgBjc0lTT0xhdGluR3JlZWsAJGF0ZW5kAE5VTEwAaDQAY3NJU09MYXRpbkhlYnJldwBEc3J0ACRhdHN0YXJ0ACVkICVzICVzAGhyAF8lZGYATlVMTABfJWQlY3gAc2NyaXB0AER1cGwAJG5hdGl2ZQAhdiVjAGNzS09JOFIAJXgAc3R5bGUARWd5ZAAlc20lZABfJWQlYwAkPwBjc1RJUzYyMABmb250AEVneWgAYSBwaG9uZW1lIHR5cGUgb3IgbWFubmVyIG9mIGFydGljdWxhdGlvbiBtdXN0IGJlIHNwZWNpZmllZCBiZWZvcmUgc3RhcnR0eXBlACR0ZXh0bW9kZQBfJWRlACVzZiVkAGNzVVRGOAAlcy92b2ljZXMvJXMARWd5cABfJWRvAGEgcGhvbmVtZSB0eXBlIG9yIG1hbm5lciBvZiBhcnRpY3VsYXRpb24gbXVzdCBiZSBzcGVjaWZpZWQgYmVmb3JlIGVuZHR5cGUAJHBob25lbWVtb2RlAGNzVW5pY29kZQBiAGVuZHR5cGUgbXVzdCBlcXVhbCBzdGFydHR5cGUgZm9yIGNvbnNvbmFudHMAdW5wcgBhbGwAaQBhcmFiaWMAXyVkYQBFbGJhAG5vcHJlZml4AHZvaWNpbmdzd2l0Y2ggY2Fubm90IGJlIHVzZWQgb24gdm93ZWxzAGVtAEV0aGkAXyVkAGN5cmlsbGljAHN0cmVzcyBwaG9uZW1lcyBjYW4ndCBjb250YWluIHByb2dyYW0gaW5zdHJ1Y3Rpb25zAEdlb2sAZ3JlZWsAY29kZQBfJWRYJWMAd19hbHQxAFdhcm5pbmc6IG1heGltdW0gbnVtYmVyICVkIG9mIChOX1ZPSUNFU19MSVNUID0gJWQgLSAxKSByZWFjaGVkCgAlcyVjJXMAR2VvcgBfJWRYZgAlYyVkJWMAZ3JlZWs4AHdfYWx0MgBNaXNzaW5nICdlbmRwaG9uZW1lJyBiZWZvcmUgJyVzJwBoZWJyZXcAZGVmYXVsdABHbGFnAF8lZFgATWlzc2luZyBFTkRJRgB3X2FsdDMARXJyb3IgKCVzKTogZ2VuZGVyIGF0dHJpYnV0ZSBzcGVjaWZpZWQgb24gYSBsYW5ndWFnZSBmaWxlCgBzaWxlbnQAR29uZwAnZW5kcGhvbmVtZScgbm90IGV4cGVjdGVkIGhlcmUAaXNvLWNlbHRpYwB3X2FsdDQAX29yZDIwAHgtc29mdABHb25tAFBob25lbWUgdHlwZSBpcyBtaXNzaW5nAF9vcmQAaXNvLWlyLTYAd19hbHQ1AHNvZnQAR290aAB3X2FsdDYAaXNvLWlyLTEwMABCYWQgcGhvbmVtZSBuYW1lICclcycAd19hbHQAJXMlcyVzAEdyYW4AbG91ZABpc28taXItMTAxACVzOiAnJXMnLgBHcmVrAHgtbG91ZABpc28taXItMTA5AHBfYWx0MQB4LXNsb3cAR3VqcgBwX2FsdDIAaXNvLWlyLTExMABFeHBlY3RlZCAnKCcAc2xvdwBHdXJ1AGlzby1pci0xMjYAcF9hbHQzAEV4cGVjdGVkICcpJwBmYXN0AEhhbmcAVmFsdWUgJWQgaXMgZ3JlYXRlciB0aGFuIG1heGltdW0gJWQAaXNvLWlyLTEyNwBwX2FsdDQAeC1mYXN0AEhhbmkAaXNvLWlyLTEzOABwX2FsdDUAQ2Fubm90IGZpbmQgcGhvbmVtZSAnJXMnIHRvIGltcG9ydC4AeC1sb3cASGFubwBwX2FsdDYAaXNvLWlyLTE0NABQaG9uZW1lIGltcG9ydCB3aWxsIG92ZXJyaWRlIHNldCBwcm9wZXJ0aWVzLgBsb3cAcF9hbHQASGFucwBpc28taXItMTQ4AFBob25lbWUgcmVmZXJlbmNlIG5vdCBmb3VuZDogJyVzJwAlcyVzLnR4dABIYW50AGhpZ2gAaXNvLWlyLTE1NwBjb21waWxlOiB1bmtub3duIHBob25lbWUgdGFibGU6ICclcycAJXMlcwBIYXRyAHgtaGlnaABQaG9uZW1lIHByb2dyYW0gdG9vIGxhcmdlAGlzby1pci0xOTkASGVicgBpc28taXItMjI2AEV4cGVjdGVkIGEgY29uZGl0aW9uLCBub3QgJyVzJwBzcGFjZSAAQ2FuJ3QgYWxsb2NhdGUgbWVtb3J5CgBFeHBlY3RlZCBsaXN0IG9mIHN0cmVzcyBsZXZlbHMASGlyYQBsYXRpbjEAdGFiIAAJJWQgZW50cmllcwoASGx1dwBsYXRpbjIAVW5leHBlY3RlZCBrZXl3b3JkICclcycAdW5kZXJzY29yZSAAJTVkOiBVbmtub3duIGtleXdvcmQ6ICVzCgBIbW5nAHBob25lbWUAbGF0aW4zAGRvdWJsZS1xdW90ZSAAJTVkOiBNaXNzaW5nICcoJwoASHJrdABlbmRwaG9uZW1lAG1hbGUAbGF0aW40AEh1bmcAZmVtYWxlAEV4cGVjdGVkIEFORCwgT1IsIFRIRU4AbGF0aW41ACU1ZDogTmVlZCB0byBjb21waWxlIGRpY3Rpb25hcnkgYWdhaW4KAEluZHMAbmV1dHJhbABFTFNFIG5vdCBleHBlY3RlZABsYXRpbjYAJTVkOiBCYWQgcGhvbmVtZSBbJXNdIChVKyV4KSBpbjogJXMgICVzCgBVKyV4AEl0YWwASUYgYmxvY2sgaXMgdG9vIGxvbmcAeG1sOmxhbmcAbGF0aW44AHZhcmlhbnQARUxJRiBub3QgZXhwZWN0ZWQASmF2YQBsYXRpbjEwACU1ZDogRGljdGlvbmFyeSBsaW5lIGxlbmd0aCB3b3VsZCBvdmVyZmxvdyB0aGUgZGF0YSBidWZmZXI6ICVkCgBKcGFuAGFnZQBFTkRJRiBub3QgZXhwZWN0ZWQAbDEAJTVkOiBUd28gbWFueSBwYXJ0cyBpbiBhIG11bHRpLXdvcmQgZW50cnk6ICVkCgBnZW5kZXIASnVyYwBQYXJhbWV0ZXIgPiAxMjcAbDIALy8AJXMrJXMAS2FsaQAuTABQYXJhbWV0ZXIgPCAtMTI4AGwzAGd0AC5yZXBsYWNlAEthbmEAUGFyYW1ldGVyID4gMjU1AGw0AGx0AEtoYXIALmdyb3VwAERGVABsNQAweCV4ACVzLyVzLndhdgBLaG1yAGFtcABsNgBxdW90AENhbid0IHJlYWQgZmlsZTogJXMAS2hvagBsOAAlNWQ6IEdyb3VwIG5hbWUgbG9uZ2VyIHRoYW4gMiBieXRlcyAoVVRGOCkARmlsZSBub3QgU1BFQyBvciBSSUZGOiAlcwBuYnNwAEtuZGEAbDEwAApFeGNlZWRlZCBsaW1pdCBvZiBydWxlcyAoJWQpIGluIGdyb3VwICclcycKAHVzAGFwb3MAS29yZQAlYyAgMHglLjV4ICAlcwoAAMDg8P8fDwdwCnEKAAAoACkAWwBdAHsAfQA8AD4AIgAnAGAAqwC7AAowCzA84A==");n(g,93904,"ICAgICAgICAgICYlKyNTRFpBTCEgQD9KTktWP1RYP1dBQkNIRkdZPT0sLCcqICAAIAAhACIAsAIkACUA5gDIAigAKQB+AisAzAItAC4ALwBSAjEAMgBcAjQANQA2ADcAdQI5ANACsgI8AD0APgCUAlkCUQKyA+cA8ABbAkYAYgInAWoCXwJLAGsCcQJLAVQCpgNjAoACgwK4A4oCjAJTAccD+ACSAioDXABdAF4AXwBgAGEAYgBjAGQAZQBmAGECaABpAGoAawBsAG0AbgBvAHAAcQByAHMAdAB1AHYAdwB4AHkAegB7AHwAfQADA38APT0sLCcnAAMCBAUGBxoAAAAAAQECAwMEBQYHBwgJCgsAAAEBAgIDAwQFBgcHCAkKAAABAgMDAwQFBgcHBwgJClNldFdvcmRTdHJlc3MA5ADrAO8A9gD8AP8AAAAAAAAAYWFhYWFhYWNlZWVlaWlpaWRub29vb28Ab3V1dXV5dHNhYWFhYWFhY2VlZWVpaWlpZG5vb29vbwBvdXV1dXl0eWFhYWFhYWNjY2NjY2NjZGRkZGVlZWVlZWVlZWVnZ2dnZ2dnZ2hoaGhpaWlpaWlpaWlpaWlqamtra2xsbGxsbGxsbGxubm5ubm5ubm5vb29vb29vb3JycnJycnNzc3Nzc3NzdHR0dHR0dXV1dXV1dXV1dXV1d3d5eXl6enp6enpzYmJiYgAAb2NjZGRkZGRlZWVmZmdnaGlpa2tsbG1ubm9vb29vcHB5AABzc3R0dHR1dXV2eXl6enp6enp6AAAAd3R0dGtkZGRsbGxubm5hYWlpb291dXV1dXV1dXV1ZWFhYWFhYWdnZ2dra29vb296empkZGRnZ3d3bm5hYWFhb29hYWFhZWVlZWlpaWlvb29vcnJycnV1dXVzc3R0eXloaG5kb296emFhZWVvb29vb29vb3l5bG50amRxYWNjbHRzegAAYnV2ZWVqanFxcnJ5eWFhYWJvY2RkZWVlZWVl");n(g,94846,"TG9va3VwRGljdDIAAAAAAAAAgACBAIIAgwCEAIUAhgCHAIgAiQCKAIsAjACNAI4AjwCQAJEAkgCTAJQAlQCWAJcAmACZAJoAmwCcAJ0AngCfAKAAoQCiAKMApAClAKYApwCoAKkAqgCrAKwArQCuAK8AsACxALIAswC0ALUAtgC3ALgAuQC6ALsAvAC9AL4AvwDAAMEAwgDDAMQAxQDGAMcAyADJAMoAywDMAM0AzgDPANAA0QDSANMA1ADVANYA1wDYANkA2gDbANwA3QDeAN8A4ADhAOIA4wDkAOUA5gDnAOgA6QDqAOsA7ADtAO4A7wDwAPEA8gDzAPQA9QD2APcA+AD5APoA+wD8AP0A/gD/AIAAgQCCAIMAhACFAIYAhwCIAIkAigCLAIwAjQCOAI8AkACRAJIAkwCUAJUAlgCXAJgAmQCaAJsAnACdAJ4AnwCgAAQB2AJBAaQAPQFaAacAqABgAV4BZAF5Aa0AfQF7AbAABQHbAkIBtAA+AVsBxwK4AGEBXwFlAXoB3QJ+AXwBVAHBAMIAAgHEADkBBgHHAAwByQAYAcsAGgHNAM4ADgEQAUMBRwHTANQAUAHWANcAWAFuAdoAcAHcAN0AYgHfAFUB4QDiAAMB5AA6AQcB5wANAekAGQHrABsB7QDuAA8BEQFEAUgB8wD0AFEB9gD3AFkBbwH6AHEB/AD9AGMB2QKAAIEAggCDAIQAhQCGAIcAiACJAIoAiwCMAI0AjgCPAJAAkQCSAJMAlACVAJYAlwCYAJkAmgCbAJwAnQCeAJ8AoAAmAdgCowCkAP3/JAGnAKgAMAFeAR4BNAGtAP3/ewGwACcBsgCzALQAtQAlAbcAuAAxAV8BHwE1Ab0A/f98AcAAwQDCAP3/xAAKAQgBxwDIAMkAygDLAMwAzQDOAM8A/f/RANIA0wDUACAB1gDXABwB2QDaANsA3ABsAVwB3wDgAOEA4gD9/+QACwEJAecA6ADpAOoA6wDsAO0A7gDvAP3/8QDyAPMA9AAhAfYA9wAdAfkA+gD7APwAbQFdAdkCgACBAIIAgwCEAIUAhgCHAIgAiQCKAIsAjACNAI4AjwCQAJEAkgCTAJQAlQCWAJcAmACZAJoAmwCcAJ0AngCfAKAABAE4AVYBpAAoATsBpwCoAGABEgEiAWYBrQB9Aa8AsAAFAdsCVwG0ACkBPAHHArgAYQETASMBZwFKAX4BSwEAAcEAwgDDAMQAxQDGAC4BDAHJABgBywAWAc0AzgAqARABRQFMATYB1ADVANYA1wDYAHIB2gDbANwAaAFqAd8AAQHhAOIA4wDkAOUA5gAvAQ0B6QAZAesAFwHtAO4AKwERAUYBTQE3AfQA9QD2APcA+ABzAfoA+wD8AGkBawHZAoAAgQCCAIMAhACFAIYAhwCIAIkAigCLAIwAjQCOAI8AkACRAJIAkwCUAJUAlgCXAJgAmQCaAJsAnACdAJ4AnwCgAAEEAgQDBAQEBQQGBAcECAQJBAoECwQMBK0ADgQPBBAEEQQSBBMEFAQVBBYEFwQYBBkEGgQbBBwEHQQeBB8EIAQhBCIEIwQkBCUEJgQnBCgEKQQqBCsELAQtBC4ELwQwBDEEMgQzBDQENQQ2BDcEOAQ5BDoEOwQ8BD0EPgQ/BEAEQQRCBEMERARFBEYERwRIBEkESgRLBEwETQROBE8EFiFRBFIEUwRUBFUEVgRXBFgEWQRaBFsEXASnAF4EXwSAAIEAggCDAIQAhQCGAIcAiACJAIoAiwCMAI0AjgCPAJAAkQCSAJMAlACVAJYAlwCYAJkAmgCbAJwAnQCeAJ8AoAD9//3//f+kAP3//f/9//3//f/9//3/DAatAP3//f/9//3//f/9//3//f/9//3//f/9//3/Gwb9//3//f8fBv3/IQYiBiMGJAYlBiYGJwYoBikGKgYrBiwGLQYuBi8GMAYxBjIGMwY0BjUGNgY3BjgGOQY6Bv3//f/9//3//f9ABkEGQgZDBkQGRQZGBkcGSAZJBkoGSwZMBk0GTgZPBlAGUQZSBv3//f/9//3//f/9//3//f/9//3//f/9//3/gACBAIIAgwCEAIUAhgCHAIgAiQCKAIsAjACNAI4AjwCQAJEAkgCTAJQAlQCWAJcAmACZAJoAmwCcAJ0AngCfAKAAGCAZIKMArCCvIKYApwCoAKkAegOrAKwArQD9/xUgsACxALIAswCEA4UDhgO3AIgDiQOKA7sAjAO9AI4DjwOQA5EDkgOTA5QDlQOWA5cDmAOZA5oDmwOcA50DngOfA6ADoQP9/6MDpAOlA6YDpwOoA6kDqgOrA6wDrQOuA68DsAOxA7IDswO0A7UDtgO3A7gDuQO6A7sDvAO9A74DvwPAA8EDwgPDA8QDxQPGA8cDyAPJA8oDywPMA80DzgP9/4AAgQCCAIMAhACFAIYAhwCIAIkAigCLAIwAjQCOAI8AkACRAJIAkwCUAJUAlgCXAJgAmQCaAJsAnACdAJ4AnwCgAP3/ogCjAKQApQCmAKcAqACpANcAqwCsAK0ArgCvALAAsQCyALMAtAC1ALYAtwC4ALkA9wC7ALwAvQC+AP3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f8XINAF0QXSBdMF1AXVBdYF1wXYBdkF2gXbBdwF3QXeBd8F4AXhBeIF4wXkBeUF5gXnBegF6QXqBf3//f8OIA8g/f+AAIEAggCDAIQAhQCGAIcAiACJAIoAiwCMAI0AjgCPAJAAkQCSAJMAlACVAJYAlwCYAJkAmgCbAJwAnQCeAJ8AoAChAKIAowCkAKUApgCnAKgAqQCqAKsArACtAK4ArwCwALEAsgCzALQAtQC2ALcAuAC5ALoAuwC8AL0AvgC/AMAAwQDCAMMAxADFAMYAxwDIAMkAygDLAMwAzQDOAM8AHgHRANIA0wDUANUA1gDXANgA2QDaANsA3AAwAV4B3wDgAOEA4gDjAOQA5QDmAOcA6ADpAOoA6wDsAO0A7gDvAB8B8QDyAPMA9AD1APYA9wD4APkA+gD7APwAMQFfAf8AgACBAIIAgwCEAIUAhgCHAIgAiQCKAIsAjACNAI4AjwCQAJEAkgCTAJQAlQCWAJcAmACZAJoAmwCcAJ0AngCfAKAABAESASIBKgEoATYBpwA7ARABYAFmAX0BrQBqAUoBsAAFARMBIwErASkBNwG3ADwBEQFhAWcBfgEVIGsBSwEAAcEAwgDDAMQAxQDGAC4BDAHJABgBywAWAc0AzgDPANAARQFMAdMA1ADVANYAaAHYAHIB2gDbANwA3QDeAN8AAQHhAOIA4wDkAOUA5gAvAQ0B6QAZAesAFwHtAO4A7wDwAEYBTQHzAPQA9QD2AGkB+ABzAfoA+wD8AP0A/gA4AYAAgQCCAIMAhACFAIYAhwCIAIkAigCLAIwAjQCOAI8AkACRAJIAkwCUAJUAlgCXAJgAmQCaAJsAnACdAJ4AnwCgAAEOAg4DDgQOBQ4GDgcOCA4JDgoOCw4MDg0ODg4PDhAOEQ4SDhMOFA4VDhYOFw4YDhkOGg4bDhwOHQ4eDh8OIA4hDiIOIw4kDiUOJg4nDigOKQ4qDisOLA4tDi4OLw4wDjEOMg4zDjQONQ42DjcOOA45DjoO/f/9//3//f8/DkAOQQ5CDkMORA5FDkYORw5IDkkOSg5LDkwOTQ5ODk8OUA5RDlIOUw5UDlUOVg5XDlgOWQ5aDlsO/f/9//3//f+AAIEAggCDAIQAhQCGAIcAiACJAIoAiwCMAI0AjgCPAJAAkQCSAJMAlACVAJYAlwCYAJkAmgCbAJwAnQCeAJ8AoAAdIKIAowCkAB4gpgCnANgAqQBWAasArACtAK4AxgCwALEAsgCzABwgtQC2ALcA+AC5AFcBuwC8AL0AvgDmAAQBLgEAAQYBxADFABgBEgEMAckAeQEWASIBNgEqATsBYAFDAUUB0wBMAdUA1gDXAHIBQQFaAWoB3AB7AX0B3wAFAS8BAQEHAeQA5QAZARMBDQHpAHoBFwEjATcBKwE8AWEBRAFGAfMATQH1APYA9wBzAUIBWwFrAfwAfAF+ARkggACBAIIAgwCEAIUAhgCHAIgAiQCKAIsAjACNAI4AjwCQAJEAkgCTAJQAlQCWAJcAmACZAJoAmwCcAJ0AngCfAKAAAh4DHqMACgELAQoepwCAHqkAgh4LHvIerQCuAHgBHh4fHiABIQFAHkEetgBWHoEeVx6DHmAe8x6EHoUeYR7AAMEAwgDDAMQAxQDGAMcAyADJAMoAywDMAM0AzgDPAHQB0QDSANMA1ADVANYAah7YANkA2gDbANwA3QB2Ad8A4ADhAOIA4wDkAOUA5gDnAOgA6QDqAOsA7ADtAO4A7wB1AfEA8gDzAPQA9QD2AGse+AD5APoA+wD8AP0AdwH/AIAAgQCCAIMAhACFAIYAhwCIAIkAigCLAIwAjQCOAI8AkACRAJIAkwCUAJUAlgCXAJgAmQCaAJsAnACdAJ4AnwCgAKEAogCjAKwgpQBgAacAYQGpAKoAqwCsAK0ArgCvALAAsQCyALMAfQG1ALYAtwB+AbkAugC7AFIBUwF4Ab8AwADBAMIAwwDEAMUAxgDHAMgAyQDKAMsAzADNAM4AzwDQANEA0gDTANQA1QDWANcA2ADZANoA2wDcAN0A3gDfAOAA4QDiAOMA5ADlAOYA5wDoAOkA6gDrAOwA7QDuAO8A8ADxAPIA8wD0APUA9gD3APgA+QD6APsA/AD9AP4A/wCAAIEAggCDAIQAhQCGAIcAiACJAIoAiwCMAI0AjgCPAJAAkQCSAJMAlACVAJYAlwCYAJkAmgCbAJwAnQCeAJ8AoAAEAQUBQQGsIB4gYAGnAGEBqQAYAqsAeQGtAHoBewGwALEADAFCAX0BHSC2ALcAfgENARkCuwBSAVMBeAF8AcAAwQDCAAIBxAAGAcYAxwDIAMkAygDLAMwAzQDOAM8AEAFDAdIA0wDUAFAB1gBaAXAB2QDaANsA3AAYARoC3wDgAOEA4gADAeQABwHmAOcA6ADpAOoA6wDsAO0A7gDvABEBRAHyAPMA9ABRAfYAWwFxAfkA+gD7APwAGQEbAv8AgACBAIIAgwCEAIUAhgCHAIgAiQCKAIsAjACNAI4AjwCQAJEAkgCTAJQAlQCWAJcAmACZAJoAmwCcAJ0AngCfAKAABAEFAUEBrCAeIGABpwBhAakAGAKrAHkBrQB6AXsBsACxAAwBQgF9AR0gtgC3AH4BDQEZArsAUgFTAXgBfAHAAMEAwgACAcQABgHGAMcAyADJAMoAywDMAM0AzgDPABABQwHSANMA1ABQAdYAWgFwAdkA2gDbANwAGAEaAt8A4ADhAOIAAwHkAAcB5gDnAOgA6QDqAOsA7ADtAO4A7wARAUQB8gDzAPQAUQH2AFsBcQH5APoA+wD8ABkBGwL/AP3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9/wEJAgkDCQUJBgkHCQgJCQkKCQsJDgkPCRAJDQkSCRMJFAkRCRUJFgkXCRgJGQkaCRsJHAkdCR4JHwkgCSEJIgkjCSQJJQkmCScJKAkpCSoJKwksCS0JLgkvCV8JMAkxCTIJMwk0CTUJNgk3CTgJOQkgAD4JPwlACUEJQglDCUYJRwlICUUJSglLCUwJSQlNCTwJZAn9//3//f/9//3/IAAwADEAMgAzADQANQA2ADcAOAA5AP3//f/9//3//f8CAAAAAAAAAAEAAAADAAAA//36+Pb08vDu7Oro5uTi4N7c2tjW1NLQzszKyMbEwsC+vLq4trSysK6sqqimpKKgnpyamJaUkpCOjIqIhoSCgH58enh2dHJwbmxqaGZkYmBeXFpYVlRSUE5MSkhGREJAPjw6ODY0MjAuLCooJiQiIB4cGhgWFBIQDgwKCAYEAgAAAgQGCAoMDhASFBYYGhweICIkJigqLC4wMjQ2ODo8PkBCREZISkxOUFJUVlhaXF5gYmRmaGpsbnBydHZ4enx+gIKEhoiKjI6QkpSWmJqcnqCipKaoqqyusLK0tri6vL7AwsTGyMrMztDS1NbY2tze4OLk5ujq7O7w8vT2+Pr9///06uDWzMO6saifl4+Hf3hxamNcVlBKRD85NC8rJiIeGhcTEA0LCAYEAgEAAAAAAAAAAQIDBAUHCAoMDhATFRcaHR8iJSgsLjAyNDY5Oz1AQkVHSkxPUVRXWl1fYmVoa25xdHh7foGFiIuPkpaZnaCkqKyvs7e7v8PHy8/T19vgz8zJxsPAvbm0sKunopyXkoyGgXt1b2ljXVdQSkQ+ODMtJyIcFxINCAQCAgEAAAAAAAEBAgMEBQcICgwNDxIUFhkbHiEkJyotMDQ2ODo8P0FDRkhLTVBSVVhaXWBjZmlsb3J1eHt+gYWIi4+SlpmdoKSorK+zt7u/w8fLz9PX2+D/+fTu6eTf2tXQy8bBvbizr6qmoZ2ZlZCMiISAfXl1cW5qZ2NgXVlWU1BNSkdEQT48OTc0Mi8tKygmJCIgHhwaGRcVFBIRDw4NDAoJCAcGBQUEAwICAQE=");n(g,99845,"AQECAgMEBAUGBwgJCgsMDg8QEhMVFxgaHB4g0M7NzMrIx8XDwcC9u7i1s7CtqqejoJ2ZlpKPi4eEgHx4dHBtaWVhXVlVUU1KRkI+Ozc0MS8tKigmJCIgHhwaGRcVFBIRDw4NDAoJCAcGBQUEAwICAQE=");n(g,99973,"AQECAgMEBAUGBwgJCgsMDg8QEhMVFxgaHB4gmJmZmpydn6Gkp6mssLO2ur7BxcnN0dTY3N/j5urt8PL19/n7/P3+/v////////79+/r49vPx7uzp5uTg3drX09DMyMTAvLi0sKyno5+alpGNiIR/e3ZybWllYFxYVFBMSERAPDk1Mi8rKCYjIB0aFxUSDw0KCAcFAwIBAAAAAAD+///////+/fz6+Pb08e7r6OXh3trW0s3JxL+6trCrpqGclpGLhoB7dW9qZF9ZVE9JRD86NTArJiIdGRURDQoHBAMBAAAAAAAAAAABAQIEBQcJCw0QEhUYGx4iJSktMTU6PkNITFFXW15iZWhrbnF0dnh7fH6AgYKDg4SEg4OCgXJycXFwb21samhmZGFfXFpXVFFOS0hFQj87ODUyLywpJiMgHRsYFhQSEA4MCwoJCAcHBwcHBgUFBQUFBQUFBQYHBwgJCgwNDxASFBYYGx0gIyYpLC8zNzs/Q0dMUVZbYGVqb3R5f4SJj5Wboaets7rAx87V3OPq8fX3+vz9/v///v79/fz7+/r6+fj49/f29vX09PPz8vLx8PDv7u7t7Ovq6uno5+bl5OPi4eDe3dzb2djW1dPS0M7My8nHxcPAvry5t7Wyr62qp6ShnpqXlJCNiYWBfXl1cW1oZGFeW1dUUU1KRkNAPDk1Mi4qJyMfHBgUEQ0LCQcFBAMCAQAAAAAAAAAAAQEBAgIDAwQEBQYGBwgICQoLDAwNDg8QERITFBYXGBkbHB0fICIjJSYoKSstLzAyNDY4Ojw+QEJER0lLTlBSVVdaXV9iZWdqbXBzdnl8f4KGiYyQk5aanaCjpqmsr7K1uLu+wcTHys3Q09bZ3N/i5Ofp7O7w8vT2+Pr7/X9/f4CBg4SHiYyPkpaZnaGlqq6yt7vAxcnN0tba3uLm6u3w8/X4+vv8/f7+/fz7+ff08Ozn4tzVzsa9tKmekoiCfXdybGZgWlROSUI8NzItKCQfGxgUEQ4MCQcGBQQEBAQFBggKDRAUGB0jKS83PkdQWmRwfIOFiIqMjo+RkpOTAEAIAEYSAAAAAAAAGAwAAARQEgZOFgAAAAAAACI0AAAEWBYGUhYAAAAAAAAiQAAAAFwIAFxQAAAAAAAATAgBAABWBABeQgAAAAAAACIKAAAAPgoAPhQAAAAAAAAcEAAABEQSBkQWAAAAAAAAHiwAAAZAEABCIAAAAAAAACASAAACRC4AKiAAAAAAAAAuOgAABE4YBkgWAAAAAAAAKjQAAARYIgBAIAAAAAAAAC5SAAAAOAwAOBQAAAAAAAAYDAAAAEYSAEYYAAAAAAAAIBQAAAkAAAAJAAAAEAAAABAAAAAQAAAAFwAAADcAAAAgAAAAACgYCAAKNCAUCgYmGA4EAAYAAAAHAAAACQAAAAkAAAAUAAAAFAAAABQAAAAZAAAA5iAUCA==");n(g,101072,"ZgNmAWYCpgSmAiYEpoooAmoDagFqAqoCbgNuAW4CrgIpALMEdAN0AXQCtAS0AgAAdAR6A3oBegK6An4BOQC+AgAApgMAAKYBAADmAwAAaAEAAGgCAAAoAwAA6AEAAOkBAABpBAAAqgMAAKoBAAAqAwAA6gMAAOoBAABsAgAArAEAACwDAAAsAgAAbQIAAG0EAACuBAAArgMAAK4BAADuAwAALgAAAO6LAABvAgAAMAIwAAAAcQEAADECAADxAQAAMQMAAHEEAABzAQAAMwIAAPMBMwAAADMAAAC0AwAAtAEAAPQCAAC0igAAdwEAADcCAAD3AQAAeAEAAHgCAAA4AgAA+AEAADkCAAD5AQAAeQQAALoEAAC6AwAAugEAADoEAAD6AgAA+gMAAHwCAAB+AgAAAAB/AQAAPwMAAP8BOACmAAEAgQBnBQAAKAEpBWkF6gAAAEIFAADDAEMdAADvBGwFLABsAAQAAACtAG0FAADuBAUAbgCxBPEEMQXxj7IAAAByBQAAMwVzAPQEtJoAAAgAtwCOADcVAAA3BQAAzQB3ALcIOAUAAG8FyQAJAbkAOQX6BAoAewW7ALwAvgB+AD8FPwEAAAsBAADMAIwAAAAAAGcAAABsDW0ALwGwAHEAdgVMBEwc6Y8AAOnPOY4AADnO");n(g,101586,"sQNZAlsCswO5A1MByQPGA4MCxQOSApQCfgJ8AgAAqgBhgLIAMoCzADOAuQAxgLoAb4CwAmiAsQJmgrICaoCzAnKAtAJ5grUCe4K2AoGCtwJ3gLgCeYDAApSCwQKVguACY4LhAmyA4gJzgOMCeIBwIDCAcSBpgHQgNIB1IDWAdiA2gHcgN4B4IDiAeSA5gHogK4B7IC2AfCA9gH0gKIB+ICmAfyBugIAgMECBIDFAgiAyQIMgM0CEIDRAhSA1QIYgNkCHIDdAiCA4QIkgOUCKICtAiyAtQIwgPUCNIChAjiApQJAgYUCRIGVAkiBvQJMgeECUIFlClSBoQJYga0CXIGxAmCBtQJkgbkCaIHBAmyBzQJwgdEAAAAAAaXhjbXZsZA==");n(g,101888,"AQAAAAoAAABkAAAA6AMAAAUAAAAyAAAA9AEAAAAXCgkYExgY");n(g,101936,"///////9+fXy7uvo5OHe2tjV0s/MycbEwb+8ure1s7CurKmopaOhn56bmZiWlJKRj42LiYiHhYOCgX9+fHt6eHd2dXNycXBvbm1ramloZ2ZlZGNiYWBfXl1cW1pZWVhXVlVUU1JSUVBQT05NTExLS0pJSEdHRkVFRENDQkJBQEA/Pj49PTw7Ozo6OTk4ODc2NjU1NDQ0MzIyMTEwMC8vLi4uLS0sLCwrKyopKCgoJycnJiYmJSUlJCQjIyMjIiIiISEhICAfHx8eHh4dHR0dHBwbGxsbGhoaGhkZGRgYGBgXFxcXFhYWFRUVFRQUFBQTExMSEhERERAQEBAQEA8PDw8ODg4NDQ0MDAwMCwsLCwoKCgkJCQgICAAAAAAAAAAAeHl4d3d2dnV0dHNycXBwb29ubWxrampoZ2dmZmZlZWNiYmFgYF9eXVtaW1pZWFZVVlVVVFJRUE9NTk5MTUtLSklHSEZFRUVDQUA/Pz89PTs7Ozo4OTo4NjU0NDU0NDIwLy8tLi0=");n(g,102336,"FhYWFhYWFhUVFRUUFBMTEhEQDw8PDw8PDwAAAAAAAABkeGRpZG5uZF9kaXhpbn2Ch3N9ZGl4S2RLaXhVS2RpeFVpX3N4ZF9kbnhfaWRzeGRkZGl4ZGlfc3huX2RpeGRpaXp9bmlkaXhkaWl6fW5pZGl4X2lkc3huZGRkeGRkZGRkZGRk");n(g,102480,"ZJZkaW5zbm5uZGmWaW59h4xzh2RpllppWnqHZFpkaZZkaWR6h2RkZGmWZGlpc4duaWRplmRpaXqCeH1kaZZkaW56fXNuZGmWZGlpeod4aWRplmRpaXOHbmlkZGRkZGRkZGRkZA==");n(g,102592,"bnhkbm5ubm5ubm54ZG5ubm5ubm5ueGRuZG5ubmRubnhkbm5ubm5ubm54ZG5ubm5ubm5ueGRubm5ubm5ubnhkbm5ubm5ubm54ZG5ubm5ubm5ueGRubm5ubm5ubnhkbm5ubm5ubg==");n(g,102708,"rwAAAGQAAAAyAAAAMg==");n(g,102744,"ZA==");n(g,102764,"MjIoRlpkZGRGboeWZGRLZHiWAAAAAAAABwAAAA4AAAAVAAAAKAAAAFAAAAAAAAAAAFNBUFIAQwAAAAAARgAAAAAAAAABAAAAAgAAAAQAAAAPAAAAAAEAAAEBAAEBAgQAAAAAAPMAEAEAAQABAAEAAQAB8ADwAPA=");n(g,102898,"QABaAG4AgACPAJwAqQC1AMAAygDUAN0A5gDvAPcAAAEHAQ8BFgEeASUBLAEyATkBQAFGAUwBUgFYAV4BZAFqAW8BdQF6AYABhQGKAY8BlAGZAZ4BowGoAa0BsgG2AbsBwAHEAckBzQHRAdYB2gHeAeMB5wHrAe8B8wH3AfsBAAIDAgcCCwIPAhMCFwIbAh8CIgImAioCLQIxAjUCOAI8AkACQwJHAkoCTgJRAlQCWAJbAl8CYgJlAmkCbAJvAnMCdgJ5AnwCgAKDAoYCiQKMAo8CkgKWApkCnAKfAqICpQKoAqsCrgKxArQCtwK6Ar0CwALCAsUCyALLAs4C0QLUAtYC2QLcAt8C4gLkAucC6gLtAu8C8gL1AvcC+gL9AgADAgMFAwcDCgMNAw8DEgMVAxcDGgMcAx8DIQMkAycDKQMsAy4DMQMzAzYDOAM7Az0DQANCA0QDRwNJA0wDTgNRA1MDVQNYA1oDXQNfA2EDZANmA2gDawNtA28DcgN0A3YDeQN7A30DgAOCA4QDhgMAAAGqAqytAwQFsLGys7S0tgYHCLkJCrwMDQ4PEBESYWJjZGVmZ2hpamtsbW5vcHFyc3R1");n(g,103360,"YAYAAPAGAABmCQAA5gkAAGYKAADmCgAAZgsAAOYLAABmDAAA5gwAAGYNAABQDgAA0A4AACAPAABAEAAAkBA=");n(g,103440,"5gDmAOYA5gAAAAAA5gDmAL4AqgC+AMgAAAAAAL4A8AC+AL4A0gDSAAAAAADSANIAyADIANIA0gAAAAAA5gDmAOYA5gDwAPAAAAAAAAQBBAGqAIwA3ADcAAAAAAD6AA4BoACMAMgAjAAAAAAA8ACgALQAtADSANIAAAAAAOYA8ACqANwAtAC0AAAAAAD6AA4BlgCCAMgAyAAAAAAADgEOAbYAjADcANwAAAAAAPgAEwGbALQA0gDSAAAAAAAOASwBwwMAAAAAAABsAAAAAAAAAKAAkQCbAJYAAAAAAMgA9QAnAAAAtwAAAAAAAADCugAAyADIAMgAyAAAAAAA0gDmAAABAgMEBQYHCAkKCwwNDg8QERITFBUWFxgZGgAAAAAAABscHR4fICEiIyQlJicoKSorAAAs");n(g,103790,"LQAAAAAAAAAu");n(g,103816,"Lw==");n(g,103833,"MAAAAAAAMQ==");n(g,103856,"Mg==");n(g,103868,"MwAAAK0AAQBABgEADCAtAAAAAAC+AL4A0gDSAAAAAADmAPoAoACWAMgAyAAAAAAA+gAEAbkAwwDDAL4AAAAAANIA3AD6AMgA+gD6AAAAAAD6APoAMjM0Njk6PD0+P0BBQkNERkdJSktMTU5PUFFSU1RWAACWAIwAtAC0AAAAAADIAMgAbA==");n(g,104016,"oADIALQAtAAAAAAA3ADwALQAoADIAMgAAAAAAPAA+gBjAAAAZgAAAGgAAABrAAAAcAAAAHQAAAB4AAAA/g==");n(g,104096,"oACMAJYApQAAAAAA2gAxAZEAkQCqAKAAAAAAAEoBXgEuAAAALAAAACcAAADIAg==");n(g,104160,"MTIzNTY3OTo7PD4/QEFCREVGR0hJSktMTU5PUFFSU1RW");n(g,104208,"vgC0AOYA5gAAAAAA+gD6ABESExQWFxkaGxwdHyAhIiQlJicoKSosc3uDmwAAAAAAtAC0AL4AtAAAAAAA5gDwALQAtAC0AKAAAAAAAOYAtABABAAAMAQAADUEAAA4BAAAOQQAAD4EAABDBAAASwQAAE0EAABOBAAATwQAAFAEAABRBAAAVgQAAFcEAABdBAAAXgQ=");n(g,104368,"tACgAMgAyAAAAAAA3ADmAKAAhwDSANIAAAAAAAQBGAGgAIwAyADIAAAAAADcAOYAyADIAMgAyAAAAAAAyADIAKAAvgCvAK8AAAAAAMgA0gCqAHMA0gDwAAAAAAAEARgBqgCqALQAtAAAAAAA8AAEAZYAtADIAMgAAAAAANIA+gCWAJYAtAC0AAAAAAAsASwBoACHANwA3AAAAAAA+gAYAaAAqgDIAMgAAAAAAEABVAG0AKAA8ADwAAAAAAAEAQQBvgC0AMgA5gAAAAAA8AD6AJYAlgC0ALQA0gDmAOYA8ABhAAAA4AAAAOEAAACjHgAA4wAAAKEeAAADAQAAsR4AAK8eAACzHgAAtR4AALceAADiAAAApx4AAKUeAACpHgAAqx4AAK0eAABlAAAA6AAAAOkAAAC7HgAAvR4AALkeAADqAAAAwR4AAL8eAADDHgAAxR4AAMceAABpAAAA7AAAAO0AAADJHgAAKQEAAMseAABvAAAA8gAAAPMAAADPHgAA9QAAAM0eAAD0AAAA0x4AANEeAADVHgAA1x4AANkeAAChAQAA3R4AANseAADfHgAA4R4AAOMeAAB1AAAA+QAAAPoAAADnHgAAaQEAAOUeAACwAQAA6x4AAOkeAADtHgAA7x4AAPEeAAB5AAAA8x4AAP0AAAD3HgAA+R4AAPUe");n(g,104896,"5gCWAOYA5gDmAAAA8AD6AAAAAAAnAAAAAAAAAAABAgM=");n(g,104945,"AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRo=");n(g,105072,"GxwdAAAeHyAhIiMkACUmAAAAACcAACgAKQAqACsAAAAAAAAsAC0ALgAAAAAALwAAADAAAAAAAAAAMQ==");n(g,105170,"MgAz");n(g,105195,"NAAAAAAANQA2");n(g,105226,"NwA4ADkArQABAAwgAQ==");n(g,105249,"AQIDAAQAAQIDAAQFBgIDAAQFBwEDAAQICQoDAAAICAoDAAALCwsLAAAMDAwMAAAMAQ4BEwEBAw8DDgYRBgMJAQsPCwEMCQwBDgYOCQ4ODg8OHA4DDxEPEg8PEBEQAREGEQkRDxETEiAS/38AAAAAlgCMANwA3AAAAAAABAEYAYKAeHRkZICAgIyAgKCrq4CAgA==");n(g,105412,"yAAAAMgAAACQAQAAkAEAAJABAABYAgAAWAIAAFgC");n(g,105456,"8AAAAKoAAACqAAAAqgAAAKoAAACqAAAAqgAAAKoAAACqAAAAAQIMAw0EDgULAAAAAQIDBAUGAAAAAAAACwwNDg==");n(g,105540,"MgAAAK8AAABkAAAAMg==");n(g,105568,"rw==");n(g,105596,"EBAKEBY=");n(g,105620,"/38AANAHAAAsAQAAYwAAAGMAAABjAAAAAAAAANAH");n(g,105668,"BA==");n(g,105680,"QEFCQ0RFRkdISUpLTE1OT1BRUlNUVldYWVtcXV5gYWJkZWdoaWtsbm9xc3R2d3l7fH6AgoSFh4mLjY+Rk5WXmZueoKKkp6mrrrCztbi6vb/CxcfKzdDT1tnc3+Ll6Ozv8vb5/P7/");n(g,105792,"//7+/v7+/v7+/v39/f38/Pz7+/v6+vn5+Pj39/b19fTz8/Lx7+3r6efl4+Hf3drY1dPQzcvIxcK/u7i1sq6rp6OgnJiUkIyIhH97d3JuaWRgXltYVlNRTkxKR0VCQD48OTc1MzEvLCooJiQiIB4dGxkXFRMSEA4MCwkHBgQDAQ==");n(g,106064,"//7+/v7+/f38+/v6+fj39vX08vHv7uzq6efl4+Hf3NrY1dPRz83LycfFw8G/vbu5t7SysK2rqaakoZ+cmpeUko+MioeEgX57eHZzcGxpZmNgX11bWlhWVVNSUE9NTEpJSEZFRENCQD8+PTw7Ojk4Nzc2NTQ0MzIyMTAwLy8uLi4tLS0sLCwsLCwsKysrKywrKiopKCgnJiYlJCQjIyIhISAgHx4eHR0cHBsaGhkZGBgXFxYWFRUUFBMTEhISEREQEA8PDw4ODQ0NDAwLCwsKCgoJCQkICAgHBwcHBgYGBQUFBQQEBAQEAwMDAwICAgICAgEBAQEBAQ==");n(g,106341,"RvIpAC8ALwBF8ikALwAuAEXyKAAuAC0ANPIoAC0tLAA08igAKysrADTyKAAqKioANPIoACkpKQA08igAAOf/zv+1/5z/g/9q/1H/N/8e/wX/7P7T/rr+of6I/m/+Vf48/iP+Cv7x/dj9v/2m/Y39dP1b/UL9Kf0Q/ff83vzF/Kz8k/x6/GH8SPwv/Bb8/fvk+8v7svuZ+4D7Z/tP+zb7HfsE++v60vq6+qH6iPpv+lf6Pvol+g369Pnb+cP5qvmR+Xn5YPlH+S/5Fvn++OX4zfi0+Jz4g/hr+FP4Ovgi+Ar48ffZ98H3qPeQ93j3YPdH9y/3F/f/9uf2z/a39p/2h/Zv9lf2P/Yn9g/29/Xf9cf1sPWY9YD1aPVR9Tn1IfUK9fL02/TD9Kz0lPR99GX0TvQ29B/0CPTw89nzwvOr85TzfPNl807zN/Mg8wnz8vLb8sTyrvKX8oDyafJS8jzyJfIO8vjx4fHL8bTxnvGH8XHxW/FE8S7xGPEB8evw1fC/8Knwk/B98GfwUfA78CXwEPD67+Tvzu+576Pvje9472LvTe847yLvDe/47uLuze647qPuju557mTuT+467iXuEO777eft0u297antlO2A7WvtV+1C7S7tGu0F7fHs3ezJ7LXsoeyN7HnsZexR7D3sKuwW7ALs7+vb68jrtOuh643reutn61TrQest6xrrB+v06uLqz+q86qnqluqE6nHqX+pM6jrqJ+oV6gPq8One6czpuumo6ZbphOly6WHpT+k96SzpGukI6ffo5ujU6MPosuig6I/ofuht6FzoS+g76CroGegI6Pjn5+fX58bntuel55Xnhed152XnVedF5zXnJecV5wXn9ubm5tfmx+a45qjmmeaK5nvma+Zc5k3mPuYw5iHmEuYD5vXl5uXY5cnlu+Wt5Z7lkOWC5XTlZuVY5UrlPOUv5SHlE+UG5fjk6+Te5NDkw+S25KnknOSP5ILkdeRo5FzkT+RD5DbkKuQd5BHkBeT54+3j4ePV48njveOx46XjmuOO44Pjd+Ns42HjVuNL4z/jNOMq4x/jFOMJ4//i9OLq4t/i1eLK4sDituKs4qLimOKO4oTie+Jx4mfiXuJU4kviQuI54i/iJuId4hTiDOID4vrh8eHp4eDh2OHQ4cfhv+G34a/hp+Gf4Zfhj+GI4YDheOFx4WrhYuFb4VThTeFG4T/hOOEx4SrhJOEd4RbhEOEK4QPh/eD34PHg6+Dl4N/g2eDU4M7gyeDD4L7guOCz4K7gqeCk4J/gmuCV4JHgjOCH4IPgfuB64HbgcuBu4GrgZuBi4F7gWuBX4FPgT+BM4EngReBC4D/gPOA54DbgM+Ax4C7gK+Ap4CfgJOAi4CDgHuAc4BrgGOAW4BTgEuAR4A/gDuAN4AvgCuAJ4AjgB+AG4AXgBeAE4APgA+AC4ALgAuAC4ALgAeAC4ALgAuAC4ALgA+AD4ATgBeAF4AbgB+AI4AngCuAL4A3gDuAP4BHgEuAU4BbgGOAa4BzgHuAg4CLgJOAn4CngK+Au4DHgM+A24DngPOA/4ELgReBJ4EzgT+BT4FfgWuBe4GLgZuBq4G7gcuB24HrgfuCD4IfgjOCR4JXgmuCf4KTgqeCu4LPguOC+4MPgyeDO4NTg2eDf4OXg6+Dx4Pfg/eAD4QrhEOEW4R3hJOEq4THhOOE/4UbhTeFU4VvhYuFq4XHheOGA4Yjhj+GX4Z/hp+Gv4bfhv+HH4dDh2OHg4enh8eH64QPiDOIU4h3iJuIv4jniQuJL4lTiXuJn4nHie+KE4o7imOKi4qzituLA4sri1eLf4uri9OL/4gnjFOMf4yrjNOM/40vjVuNh42zjd+OD447jmuOl47HjvePJ49Xj4ePt4/njBeQR5B3kKuQ25EPkT+Rc5GjkdeSC5I/knOSp5Lbkw+TQ5N7k6+T45AblE+Uh5S/lPOVK5VjlZuV05YLlkOWe5a3lu+XJ5djl5uX15QPmEuYh5jDmPuZN5lzma+Z75ormmeao5rjmx+bX5ubm9uYF5xXnJec150XnVedl53XnheeV56XntufG59fn5+f45wjoGegq6DvoS+hc6G3ofuiP6KDosujD6NTo5uj36AjpGuks6T3pT+lh6XLphOmW6ajpuunM6d7p8OkD6hXqJ+o66kzqX+px6oTqluqp6rzqz+ri6vTqB+sa6y3rQetU62freuuN66HrtOvI69vr7+sC7BbsKuw97FHsZex57I3soey17Mns3ezx7AXtGu0u7ULtV+1r7YDtlO2p7b3t0u3n7fvtEO4l7jruT+5k7nnuju6j7rjuze7i7vjuDe8i7zjvTe9i73jvje+j77nvzu/k7/rvEPAl8DvwUfBn8H3wk/Cp8L/w1fDr8AHxGPEu8UTxW/Fx8YfxnvG08cvx4fH48Q7yJfI88lLyafKA8pfyrvLE8tvy8vIJ8yDzN/NO82XzfPOU86vzwvPZ8/DzCPQf9Db0TvRl9H30lPSs9MP02/Ty9Ar1IfU59VH1aPWA9Zj1sPXH9d/19/UP9if2P/ZX9m/2h/af9rf2z/bn9v/2F/cv90f3YPd495D3qPfB99n38fcK+CL4OvhT+Gv4g/ic+LT4zfjl+P74Fvkv+Uf5YPl5+ZH5qvnD+dv59PkN+iX6PvpX+m/6iPqh+rr60vrr+gT7Hfs2+0/7Z/uA+5n7svvL++T7/fsW/C/8SPxh/Hr8k/ys/MX83vz3/BD9Kf1C/Vv9dP2N/ab9v/3Y/fH9Cv4j/jz+Vf5v/oj+of66/tP+7P4F/x7/N/9R/2r/g/+c/7X/zv/n/wAAGQAyAEsAZAB9AJYArwDJAOIA+wAUAS0BRgFfAXgBkQGrAcQB3QH2AQ8CKAJBAloCcwKMAqUCvgLXAvACCQMiAzsDVANtA4YDnwO4A9ED6gMDBBwENQROBGcEgASZBLEEygTjBPwEFQUuBUYFXwV4BZEFqQXCBdsF8wUMBiUGPQZWBm8GhwagBrkG0QbqBgIHGwczB0wHZAd9B5UHrQfGB94H9gcPCCcIPwhYCHAIiAigCLkI0QjpCAEJGQkxCUkJYQl5CZEJqQnBCdkJ8QkJCiEKOQpQCmgKgAqYCq8KxwrfCvYKDgslCz0LVAtsC4MLmwuyC8oL4Qv4CxAMJww+DFUMbAyEDJsMsgzJDOAM9wwODSUNPA1SDWkNgA2XDa4NxA3bDfINCA4fDjUOTA5iDnkOjw6lDrwO0g7oDv8OFQ8rD0EPVw9tD4MPmQ+vD8UP2w/wDwYQHBAyEEcQXRBzEIgQnhCzEMgQ3hDzEAgRHhEzEUgRXRFyEYcRnBGxEcYR2xHwEQUSGRIuEkMSVxJsEoASlRKpEr4S0hLmEvsSDxMjEzcTSxNfE3MThxObE68TwxPWE+oT/hMRFCUUOBRMFF8UcxSGFJkUrBS/FNMU5hT5FAwVHhUxFUQVVxVqFXwVjxWhFbQVxhXZFesV/RUQFiIWNBZGFlgWahZ8Fo4WnxaxFsMW1BbmFvgWCRcaFywXPRdOF2AXcReCF5MXpBe1F8UX1hfnF/gXCBgZGCkYOhhKGFsYaxh7GIsYmxirGLsYyxjbGOsY+xgKGRoZKRk5GUgZWBlnGXYZhRmVGaQZsxnCGdAZ3xnuGf0ZCxoaGigaNxpFGlMaYhpwGn4ajBqaGqgathrEGtEa3xrtGvoaCBsVGyIbMBs9G0obVxtkG3EbfhuLG5gbpBuxG70byhvWG+Mb7xv7GwccExwfHCscNxxDHE8cWxxmHHIcfRyJHJQcnxyqHLUcwRzMHNYc4RzsHPccAR0MHRYdIR0rHTYdQB1KHVQdXh1oHXIdfB2FHY8dmR2iHawdtR2+Hccd0R3aHeMd7B30Hf0dBh4PHhceIB4oHjAeOR5BHkkeUR5ZHmEeaR5xHngegB6IHo8elh6eHqUerB6zHroewR7IHs8e1h7cHuMe6h7wHvYe/R4DHwkfDx8VHxsfIR8nHywfMh83Hz0fQh9IH00fUh9XH1wfYR9mH2sfbx90H3kffR+CH4Yfih+OH5Iflh+aH54foh+mH6kfrR+xH7Qftx+7H74fwR/EH8cfyh/NH88f0h/VH9cf2R/cH94f4B/iH+Qf5h/oH+of7B/uH+8f8R/yH/Mf9R/2H/cf+B/5H/of+x/7H/wf/R/9H/4f/h/+H/4f/h//H/4f/h/+H/4f/h/9H/0f/B/7H/sf+h/5H/gf9x/2H/Uf8x/yH/Ef7x/uH+wf6h/oH+Yf5B/iH+Af3h/cH9kf1x/VH9Ifzx/NH8ofxx/EH8Efvh+7H7cftB+xH60fqR+mH6Ifnh+aH5Yfkh+OH4ofhh+CH30feR90H28fax9mH2EfXB9XH1IfTR9IH0IfPR83HzIfLB8nHyEfGx8VHw8fCR8DH/0e9h7wHuoe4x7cHtYezx7IHsEeuh6zHqwepR6eHpYejx6IHoAeeB5xHmkeYR5ZHlEeSR5BHjkeMB4oHiAeFx4PHgYe/R30Hewd4x3aHdEdxx2+HbUdrB2iHZkdjx2FHXwdch1oHV4dVB1KHUAdNh0rHSEdFh0MHQEd9xzsHOEc1hzMHMEctRyqHJ8clByJHH0cchxmHFscTxxDHDccKxwfHBMcBxz7G+8b4xvWG8obvRuxG6QbmBuLG34bcRtkG1cbShs9GzAbIhsVGwgb+hrtGt8a0RrEGrYaqBqaGowafhpwGmIaUxpFGjcaKBoaGgsa/RnuGd8Z0BnCGbMZpBmVGYUZdhlnGVgZSBk5GSkZGhkKGfsY6xjbGMsYuxirGJsYixh7GGsYWxhKGDoYKRgZGAgY+BfnF9YXxRe1F6QXkxeCF3EXYBdOFz0XLBcaFwkX+BbmFtQWwxaxFp8WjhZ8FmoWWBZGFjQWIhYQFv0V6xXZFcYVtBWhFY8VfBVqFVcVRBUxFR4VDBX5FOYU0xS/FKwUmRSGFHMUXxRMFDgUJRQRFP4T6hPWE8MTrxObE4cTcxNfE0sTNxMjEw8T+xLmEtISvhKpEpUSgBJsElcSQxIuEhkSBRLwEdsRxhGxEZwRhxFyEV0RSBEzER4RCBHzEN4QyBCzEJ4QiBBzEF0QRxAyEBwQBhDwD9sPxQ+vD5kPgw9tD1cPQQ8rDxUP/w7oDtIOvA6lDo8OeQ5iDkwONQ4fDggO8g3bDcQNrg2XDYANaQ1SDTwNJQ0ODfcM4AzJDLIMmwyEDGwMVQw+DCcMEAz4C+ELyguyC5sLgwtsC1QLPQslCw4L9grfCscKrwqYCoAKaApQCjkKIQoJCvEJ2QnBCakJkQl5CWEJSQkxCRkJAQnpCNEIuQigCIgIcAhYCD8IJwgPCPYH3gfGB60HlQd9B2QHTAczBxsHAgfqBtEGuQagBocGbwZWBj0GJQYMBvMF2wXCBakFkQV4BV8FRgUuBRUF/ATjBMoEsQSZBIAEZwROBDUEHAQDBOoD0QO4A58DhgNtA1QDOwMiAwkD8ALXAr4CpQKMAnMCWgJBAigCDwL2Ad0BxAGrAZEBeAFfAUYBLQEUAfsA4gDJAK8AlgB9AGQASwAyABkAMAAAADAAAABAAAAAUAAAAJAAAACgAAAAsAAAAMAAAACAm7XL3Ojt7Obczr+wo5iQjIuMj5KUlZKMg3hpWUk8MSopLTZEVml9j5+qsbKtpJaHeGlcU09PVV5reoiWoquwsa6ooJiRi4iJjZSdqLK7wMG9tKWSfGNKMh4OBQIFDx4wRFltf4yWnJ+fnZuZmZyhqbO/ytXc4N7YzLumj3dgSzouKCkvOkhZanqGkJSVkYmAdWtiXFpcYWl0gIqUmp6dmJCGfHFoYmBja3iIm6/C0t/m5+LXxrKchG9bS0A5Nzg9Q0pQVFZVUk1IQj8+QUlWZ3yTq8PZ6vb8+/Tn1cCqlIBxZF1aXGFocHd9f397dGthV05IRkhOWWZ1hJOfp6uqpJmLe2pbTkZDRU1aa3+SprjFz9PSzcS5raGWjomHh4qNkZKRjIR4aFVBLhwOBQEFDx80TWiBmrDBzdPT0Mi/taukn5ydoKWqrrGwq6OWh3ZjUUI2Ly0xOkhZa36OnKaqqaOYintsXVJKSEpQWmd1gi0AAAAmAAAALQAAAC0AAAA3AAAALQ==");n(g,110928,"yv5w/hICZAHgAFkAFwD2/8b/8P/NAVcCGAK9AgIDXQLxAc0BMAKUAW4A4ACDAGgAn/+bABYBZv9z+6r94QJ9ALD9KQALAAn/9v9BAFwAUADQ/kcApwD//3oA6QChANX/FgHfAeUBlwEKAYoChgBQAOwARAAEAQ0BswA1AIwAEwElASgBaAABAZgANwG2AAcB9QB9ADoBjAAsAMsA5gAV/+L+FwBrAFwApf8mANABuwGwAGIA8Pxv9p346/vA+Ur6mPoT+0v8Jv0=");n(g,111162,"BgAHAAgACQAKAAsADQAOABAAEgAUABYAGQAcACAAIwAoAC0AMwA5AEAARwBQAFoAZQByAIAAjgCfALMAygDjAAABHAE+AWcBlQHHAQACOAJ+As8CcQOPAwAEcQT8BJ4FVgYfBwAI4Qj4CTsLrAw9DgAQwxHwE3cWWBl7HAAghSPfJ+4ssDL2OABArkekUIVbZmYzc/9/");n(g,111324,"qMtoQQAAAACoy2jBAAAAAAAAAAAXCtQJkglQCQ8JzgiPCE8IEwjVB5oHYgcoB/MGvgaLBloGKwb9BdMFqQWBBVwFOAUWBfcE1wS7BKAEhgRuBFcEQQQtBBkEBwT1A+QD1APFA7YDqAOZA40DfwNxA2UDVwNLAz4DMgMkAxgDCwP+AvIC5ALYAssCvgKxAqQClwKLAn0CcgJkAlkCTAJAAjQCKAIcAhICBQL7AfAB5QHbAdABxgG7AbIBqAGeAZQBigGBAXcBbgFjAVsBUAFIAT0BNAErASABGAENAQQB+gDwAOcA3ADUAMgAwAC1AKwAoQCYAI4AhQB7AHEAaQBeAFYATABDADkAMQAnAB4AFgALAAQA+//y/+n/4P/X/87/xP+7/7L/qf+g/5X/jf+C/3r/cP9m/1z/Uv9J/z//Nf8r/yL/F/8O/wT/+v7x/uf+3f7T/sr+wP62/q3+o/6b/pD+h/59/nP+av5f/lb+TP5C/jj+Lf4j/hn+Df4D/vf97P3h/dX9yf29/bH9pf2Y/Yz9f/1z/Wb9Wf1M/T/9M/0k/Rn9Cv3//PH85fzY/Mz8vvyz/KT8mPyL/H78cfxi/FX8Rfw4/Cb8GfwG/Pb74vvQ+7r7pfuO+3b7XPtB+yT7Bvvl+sT6n/p5+lP6KPr++dD5oflw+Tz5CfnR+Jr4YPgm+Oj3q/ds9yz36/aq9mj2Jvbj9bAEdgRABA4E3wO0A4sDZQNBAx8DAAPiAsYCqwKSAnoCZAJOAjoCJwIVAgMC8wHjAdQBxgG4AasBnwGTAYcBfAFyAWgBXgFVAUwBQwE7ATMBLAEkAR0BFgEQAQkBAwH9APcA8gDtAOcA4gDdANkA1ADQAMwAxwDDAMAAvAC4ALQAsQCuAKoApwCkAKEAngCbAJkAlgCTAJEAjgCMAIkAhwCFAIMAgAB+AHwAegB4AHcAdQBzAHEAbwBuAGwAagBpAGcAZgBkAGMAYQBgAF8AXQBcAFsAWgBYAFcAVgBVAFQAUwBSAFAATwBOAE0ATABLAEsASgBJAEgARwBGAEUARABEAEMAQgBBAEAAQAA/AD4APQA9ADwAOwA7ADoAOQA5ADgAOAA3ADcANgA2ADUANQA0ADQAMwAzADIAMgAxADEAMAAwAC8ALwAuAC4ALQAtACwALAArACsAKgAqACkAKQApACkAKAAoACcAJwAmACYAJgAmACUAJQAkACQAJAAkACMAIwAjACMAIgAiACEAIQAhACEAIAAgACAAIAAfAB8AHwAfAB4AHgAeAB4AHQAdAB0AHQAcABwAHAAcABsAGwAxNkZyYW1lTWFuYWdlckltcGwAMTJGcmFtZU1hbmFnZXIAMjNTcGVlY2hXYXZlR2VuZXJhdG9ySW1wbAAxOVNwZWVjaFdhdmVHZW5lcmF0b3IAMTNXYXZlR2VuZXJhdG9y");n(g,112416,"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");n(g,115203,"QPsh+T8AAAAALUR0PgAAAICYRvg8AAAAYFHMeDsAAACAgxvwOQAAAEAgJXo4AAAAgCKC4zYAAAAAHfNpNf6CK2VHFWdAAAAAAAAAOEMAAPr+Qi52vzo7nrya9wy9vf3/////3z88VFVVVVXFP5ErF89VVaU/F9CkZxERgT8AAAAAAADIQu85+v5CLuY/JMSC/72/zj+19AzXCGusP8xQRtKrsoM/hDpOm+DXVT8=");n(g,115390,"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gryYg8kW42DvP6ySwdVQWo48hTLbA+Zp7z9LawGsWTqEPGC0AfMhc+8/Hz60ByHVgrxfm3szl3zvP8kNRzu5Kom8KaH1FEaG7z/TiDpgBLZ0PPY/i+cukO8/cXKdUezFgzyDTMf7UZrvP/CR048S94+82pCkoq+k7z99dCPimK6NvPFnji1Ir+8/CCCqQbzDjjwnWmHuG7rvPzLrqcOUK4Q8l7prNyvF7z/uhdExqWSKPEBFblt20O8/7eM75Lo3jrwUvpyt/dvvP53NkU07iXc82JCegcHn7z+JzGBBwQVTPPFxjyvC8+8/EhETFBUWFxgZGhscHR4fICERIiMkESUmJygpKissES0uLxAQMBAQEBAQEBAxMjMQNDUQEBERERERERERERERERERERERERERERERERE2ERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERNxERERE4ETk6Ozw9PhERERERERERERERERERERERERERERERERERERERERERERERERERERERERE/EBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEUBBEUJDREVGR0hJShFLTE1OT1BREFJTVFVWV1hZWltcXRBeX2AQERERYWJjEBAQEBAQEBAQEBERERFkEBAQEBAQEBAQEBAQEBAQERFlEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQERFmZxAQaGkREREREREREREREREREREREREREREREWoREWsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEWxtEBAQEBAQEBAQbhAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQb3BxchAQEBAQEBAQc3R1EBAQEBB2dxAQEBB4EBB5EBAQEBAQEBAQEBAQEBA=");n(g,117968,"//////////////////////////////////////////8AAAAAAAAAAP7//wf+//8HAAAAAAAEIAT//3////9//////////////////////////////////8P/AwAfUA==");n(g,118072,"IAAAAAAA37xA1///+////////////7///////////////////////wP8///////////////////////////+////fwL//////wEAAAAA/7+2AP///4cHAAAA/wf//////////v/D////////////////7x/+4f+fAAD///////8A4P///////////////wMA//////8HMAT////8/x8AAP///wH/BwAAAAAAAP//3z8AAPD/+AP////////////v/9/h/8///v/vn/n///3F459ZgLDP/wMQ7of5///9bcOHGQJewP8/AO6/+////e3jvxsBAM//AB7un/n///3t458ZwLDP/wIA7Mc91hjH/8PHHYEAwP8AAO/f/f///f/j3x1gB8//AADv3/3///3v498dYEDP/wYA79/9/////+ffXfCAz/8A/Oz/f/z///svf4Bf/8D/DAD+/////3//Bz8g/wMAAAAA1vf//6///ztfIP/zAAAAAAEAAAD/AwAA//7///8f/v8D///+////HwAAAAAAAAAA////////f/n/A////////////z//////vyD///////f///////////89fz3//////z3/////PX89/3//////////Pf//////////BwAAAAD//wAA/////////////z8//v//////////////////////////////////////////////////////////n////v//B////////////8f/Af/fDwD//w8A//8PAP/fDQD////////P//8BgBD/AwAAAAD/A///////////////Af//////B///////////PwD///9//w//AcD/////Px8A//////8P////A/8DAAAAAP///w//////////f/7/HwD/A/8DgA==");n(g,118768,"////////7//vD/8DAAAAAP//////8////////7//AwD///////9/AP/j//////8//wH//////+cAAAAAAN5vBP///////////////////////////////wAAAACA/x8A//8/P/////8/P/+q////P////////99f3B/PD/8f3B8=");n(g,118910,"AoAAAP8f");n(g,118928,"hPwvPlC9//PgQwAA//////8B");n(g,118982,"wP///////wMAAP//////f///////f/////////////////////8feAwA/////78g/////////4AAAP//fwB/f39/f39/f/////8AAAAAAIA=");n(g,119088,"4AAAAP4DPh/+////////////f+D+//////////////fg///////+/////////////38AAP///wcAAAAAAAD///////////////////////////////8/");n(g,119184,"////////////////////////////////////////AAD//////////////////////x8AAAAAAAAAAP//////P/8f////DwAA//////9/8I///////////////////wAAAACA//z////////////////5////////fAAAAAAAgP+//////wAAAP///////w8A//////////8vAP8DAAD86P//////B/////8HAP///x/////////3/wCA/wP///9/////////fwD/P/8D//9//P////////9/BQAAOP//PAB+fn4Af3////////f/AP///////////////////wf/A///////////////////////////DwD//3/4//////8P/////////////////z//////////////////AwAAAAB/APjg//1/X9v/////////////////AwAAAPj///////////////8/AAD///////////z///////8AAAAAAP8P");n(g,119582,"3/////////////////////8fAAD/A/7//wf+//8HwP////////////9//Pz8HAAAAAD/7///f///t/8//z8AAAAA////////////////////BwAAAAAAAAAA////////Hw==");n(g,119712,"////H////////wEAAAAAAP////8A4P///wf//////wf///8//////w//PgAAAAAA/////////////////////////z//A/////8P/////w///////wD///////8P");n(g,119824,"////////fwD//z8A/w==");n(g,119856,"P/3/////v5H//z8A//9/AP///38AAAAAAAAAAP//NwD//z8A////AwAAAAAAAAAA/////////8AAAAAAAAAAAG/w7/7//z8AAAAAAP///x////8fAAAAAP/+//8fAAAA////////PwD//z8A//8HAP//Aw==");n(g,119984,"////////////AQAAAAAAAP///////wcA////////BwD//////wD/Aw==");n(g,120048,"////H4AA//8/");n(g,120076,"//9/AP//////////PwAAAMD/AAD8////////AQAA////Af8D////////x/9wAP////9HAP//////////HgD/FwAAAAD///v///+fQAAAAAAAAAAAf73/v/8B/////////wH/A++f+f///e3jnxmB4A8=");n(g,120208,"//////////+7B/+DAAAAAP//////////swD/Aw==");n(g,120256,"////////P38AAAA/AAAAAP////////9/EQD/AwAAAAD///////8/Af8DAAAAAAAA////5/8H/wM=");n(g,120336,"/////////wE=");n(g,120356,"////////////AwCA");n(g,120388,"//z///////waAAAA////////538AAP///////////yAAAAAA/////////wH//f////9/fwEA/wMAAPz////8///+fw==");n(g,120464,"f/v/////f7TLAP8Dv/3///9/ewH/Aw==");n(g,120524,"//9/AP////////////////////////8D");n(g,120560,"/////////////////38AAP///////////////////////////////w8=");n(g,120624,"//////9/");n(g,120656,"//////////9/");n(g,120688,"/////////wH///9//wM=");n(g,120714,"////PwAA////////AAAPAP8D+P//4P//");n(g,120760,"//////////8=");n(g,120784,"////////////h/////////+A//8AAAAAAAAAAAsAAAD/////////////////////////////////////////AP///////////////////////////////////////wcA////fwAAAAAAAAcA8AD/////////////////////////////////////////////////////////////////D/////////////////8H/x//Af9D");n(g,120976,"/////////////9///////////99k3v/r7/////////+/59/f////e1/8/f//////////////////////////////////////////////////////P/////3///f////3///f////3///f////3/////9/////f//98////////9////52wc=");n(g,121136,"//////8fgD//Qw==");n(g,121192,"//////8P/wP///////////////////////////////8fAAAAAAAAAP//////////jwj/Aw==");n(g,121264,"7////5b+9wqE6paqlvf3Xv/7/w/u+/8P");n(g,121302,"////A////wP///8D");n(g,121328,"/////////////////////////////////////////////////////////////////wABAgMEBQYHCAn/////////CgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiP///////8KCwwNDg8QERITFBUWFxgZGhscHR4fICEiI/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////8=");n(g,121601,"ARcCHRgTAx4bGQsUCAQNHxYcEhoKBwwVEQkGEAUPDt4SBJUAAAAA////////////////INsBABQAAABDLlVURi04");n(g,121696,"TENfQ1RZUEUAAAAATENfTlVNRVJJQwAATENfVElNRQAAAAAATENfQ09MTEFURQAATENfTU9ORVRBUlkATENfTUVTU0FHRVM=");n(g,121776,"Qy5VVEYtOA==");n(g,121800,"MAUCAE5vIGVycm9yIGluZm9ybWF0aW9uAElsbGVnYWwgYnl0ZSBzZXF1ZW5jZQBEb21haW4gZXJyb3IAUmVzdWx0IG5vdCByZXByZXNlbnRhYmxlAE5vdCBhIHR0eQBQZXJtaXNzaW9uIGRlbmllZABPcGVyYXRpb24gbm90IHBlcm1pdHRlZABObyBzdWNoIGZpbGUgb3IgZGlyZWN0b3J5AE5vIHN1Y2ggcHJvY2VzcwBGaWxlIGV4aXN0cwBWYWx1ZSB0b28gbGFyZ2UgZm9yIGRhdGEgdHlwZQBObyBzcGFjZSBsZWZ0IG9uIGRldmljZQBPdXQgb2YgbWVtb3J5AFJlc291cmNlIGJ1c3kASW50ZXJydXB0ZWQgc3lzdGVtIGNhbGwAUmVzb3VyY2UgdGVtcG9yYXJpbHkgdW5hdmFpbGFibGUASW52YWxpZCBzZWVrAENyb3NzLWRldmljZSBsaW5rAFJlYWQtb25seSBmaWxlIHN5c3RlbQBEaXJlY3Rvcnkgbm90IGVtcHR5AENvbm5lY3Rpb24gcmVzZXQgYnkgcGVlcgBPcGVyYXRpb24gdGltZWQgb3V0AENvbm5lY3Rpb24gcmVmdXNlZABIb3N0IGlzIGRvd24ASG9zdCBpcyB1bnJlYWNoYWJsZQBBZGRyZXNzIGluIHVzZQBCcm9rZW4gcGlwZQBJL08gZXJyb3IATm8gc3VjaCBkZXZpY2Ugb3IgYWRkcmVzcwBCbG9jayBkZXZpY2UgcmVxdWlyZWQATm8gc3VjaCBkZXZpY2UATm90IGEgZGlyZWN0b3J5AElzIGEgZGlyZWN0b3J5AFRleHQgZmlsZSBidXN5AEV4ZWMgZm9ybWF0IGVycm9yAEludmFsaWQgYXJndW1lbnQAQXJndW1lbnQgbGlzdCB0b28gbG9uZwBTeW1ib2xpYyBsaW5rIGxvb3AARmlsZW5hbWUgdG9vIGxvbmcAVG9vIG1hbnkgb3BlbiBmaWxlcyBpbiBzeXN0ZW0ATm8gZmlsZSBkZXNjcmlwdG9ycyBhdmFpbGFibGUAQmFkIGZpbGUgZGVzY3JpcHRvcgBObyBjaGlsZCBwcm9jZXNzAEJhZCBhZGRyZXNzAEZpbGUgdG9vIGxhcmdlAFRvbyBtYW55IGxpbmtzAE5vIGxvY2tzIGF2YWlsYWJsZQBSZXNvdXJjZSBkZWFkbG9jayB3b3VsZCBvY2N1cgBTdGF0ZSBub3QgcmVjb3ZlcmFibGUAUHJldmlvdXMgb3duZXIgZGllZABPcGVyYXRpb24gY2FuY2VsZWQARnVuY3Rpb24gbm90IGltcGxlbWVudGVkAE5vIG1lc3NhZ2Ugb2YgZGVzaXJlZCB0eXBlAElkZW50aWZpZXIgcmVtb3ZlZABEZXZpY2Ugbm90IGEgc3RyZWFtAE5vIGRhdGEgYXZhaWxhYmxlAERldmljZSB0aW1lb3V0AE91dCBvZiBzdHJlYW1zIHJlc291cmNlcwBMaW5rIGhhcyBiZWVuIHNldmVyZWQAUHJvdG9jb2wgZXJyb3IAQmFkIG1lc3NhZ2UARmlsZSBkZXNjcmlwdG9yIGluIGJhZCBzdGF0ZQBOb3QgYSBzb2NrZXQARGVzdGluYXRpb24gYWRkcmVzcyByZXF1aXJlZABNZXNzYWdlIHRvbyBsYXJnZQBQcm90b2NvbCB3cm9uZyB0eXBlIGZvciBzb2NrZXQAUHJvdG9jb2wgbm90IGF2YWlsYWJsZQBQcm90b2NvbCBub3Qgc3VwcG9ydGVkAFNvY2tldCB0eXBlIG5vdCBzdXBwb3J0ZWQATm90IHN1cHBvcnRlZABQcm90b2NvbCBmYW1pbHkgbm90IHN1cHBvcnRlZABBZGRyZXNzIGZhbWlseSBub3Qgc3VwcG9ydGVkIGJ5IHByb3RvY29sAEFkZHJlc3Mgbm90IGF2YWlsYWJsZQBOZXR3b3JrIGlzIGRvd24ATmV0d29yayB1bnJlYWNoYWJsZQBDb25uZWN0aW9uIHJlc2V0IGJ5IG5ldHdvcmsAQ29ubmVjdGlvbiBhYm9ydGVkAE5vIGJ1ZmZlciBzcGFjZSBhdmFpbGFibGUAU29ja2V0IGlzIGNvbm5lY3RlZABTb2NrZXQgbm90IGNvbm5lY3RlZABDYW5ub3Qgc2VuZCBhZnRlciBzb2NrZXQgc2h1dGRvd24AT3BlcmF0aW9uIGFscmVhZHkgaW4gcHJvZ3Jlc3MAT3BlcmF0aW9uIGluIHByb2dyZXNzAFN0YWxlIGZpbGUgaGFuZGxlAFJlbW90ZSBJL08gZXJyb3IAUXVvdGEgZXhjZWVkZWQATm8gbWVkaXVtIGZvdW5kAFdyb25nIG1lZGl1bSB0eXBlAE11bHRpaG9wIGF0dGVtcHRlZABSZXF1aXJlZCBrZXkgbm90IGF2YWlsYWJsZQBLZXkgaGFzIGV4cGlyZWQAS2V5IGhhcyBiZWVuIHJldm9rZWQAS2V5IHdhcyByZWplY3RlZCBieSBzZXJ2aWNl");n(g,123730,"pQJbAPABtQWMBSUBgwYdA5QE/wDHAzEDCwa8AY8BfwPKBCsA2gavAEIDTgPcAQ4EFQChBg0BlAILAjgGZAK8Av8CXQPnBAsHzwLLBe8F2wXhAh4GRQKFAIICbANvBPEA8wMYBdkA2gNMBlQCewGdA70EAABRABUCuwCzA20A/wGFBC8F+QQ4AGUBRgGfALcGqAFzAlMB");n(g,123928,"IQQAAAAAAAAAAC8C");n(g,123960,"NQRHBFYE");n(g,123982,"oAQ=");n(g,124002,"RgVgBW4FYQYAAM8BAAAAAAAAAADJBukG+QYeBzkHSQdeBw==");n(g,124048,"GQAKABkZGQAAAAAFAAAAAAAACQAAAAALAAAAAAAAAAAZABEKGRkZAwoHAAEACQsYAAAJBgsAAAsABhkAAAAZGRk=");n(g,124129,"DgAAAAAAAAAAGQAKDRkZGQANAAACAAkOAAAACQAOAAAO");n(g,124187,"DA==");n(g,124199,"EwAAAAATAAAAAAkMAAAAAAAMAAAM");n(g,124245,"EA==");n(g,124257,"DwAAAAQPAAAAAAkQAAAAAAAQAAAQ");n(g,124303,"Eg==");n(g,124315,"EQAAAAARAAAAAAkSAAAAAAASAAASAAAaAAAAGhoa");n(g,124370,"GgAAABoaGgAAAAAAAAk=");n(g,124419,"FA==");n(g,124431,"FwAAAAAXAAAAAAkUAAAAAAAUAAAU");n(g,124477,"Fg==");n(g,124489,"FQAAAAAVAAAAAAkWAAAAAAAWAAAWAAAwMTIzNDU2Nzg5QUJDREVG");n(g,124564,"EQ==");n(g,124604,"//////////8=");n(g,124672,"0XSeAFedvSqAcFIP//8+JwoAAABkAAAA6AMAABAnAACghgEAQEIPAICWmAAA4fUFGAAAADUAAABxAAAAa////877//+Sv///AAAAAAAAAAACAADAAwAAwAQAAMAFAADABgAAwAcAAMAIAADACQAAwAoAAMALAADADAAAwA0AAMAOAADADwAAwBAAAMARAADAEgAAwBMAAMAUAADAFQAAwBYAAMAXAADAGAAAwBkAAMAaAADAGwAAwBwAAMAdAADAHgAAwB8AAMAAAACzAQAAwwIAAMMDAADDBAAAwwUAAMMGAADDBwAAwwgAAMMJAADDCgAAwwsAAMMMAADDDQAA0w4AAMMPAADDAAAMuwEADMMCAAzDAwAMwwQADNsAAAAAIAAAAAkAAAAKAAAADQAAAAsAAAAMAAAAhQAAAAAgAAABIAAAAiAAAAMgAAAEIAAABSAAAAYgAAAIIAAACSAAAAogAAAoIAAAKSAAAF8gAAAAMAAAAAAAAE4xMF9fY3h4YWJpdjExNl9fc2hpbV90eXBlX2luZm9FAAAAAGjpAQB46AEAZOoBAE4xMF9fY3h4YWJpdjExN19fY2xhc3NfdHlwZV9pbmZvRQAAAGjpAQCo6AEAnOgBAE4xMF9fY3h4YWJpdjExN19fcGJhc2VfdHlwZV9pbmZvRQAAAGjpAQDY6AEAnOgBAE4xMF9fY3h4YWJpdjExOV9fcG9pbnRlcl90eXBlX2luZm9FAGjpAQAI6QEA/OgBAAAAAADM6AEAFAAAABUAAAAWAAAAFwAAABgAAAAZAAAAGgAAABsAAAAAAAAAsOkBABQAAAAcAAAAFgAAABcAAAAYAAAAHQAAAB4AAAAfAAAATjEwX19jeHhhYml2MTIwX19zaV9jbGFzc190eXBlX2luZm9FAAAAAGjpAQCI6QEAzOgBAAAAAAAg6gEACQAAACAAAAAhAAAAAAAAAEjqAQAJAAAAIgAAACMAAAAAAAAACOoBAAkAAAAkAAAAJQAAAFN0OWV4Y2VwdGlvbgAAAABA6QEA+OkBAFN0OWJhZF9hbGxvYwAAAABo6QEAEOoBAAjqAQBTdDIwYmFkX2FycmF5X25ld19sZW5ndGgAAAAAaOkBACzqAQAg6gEAU3Q5dHlwZV9pbmZvAAAAAEDpAQBU6gE=");n(g,125552,"wLEAAMCyAADAswAAwLQAAMC1AADAtgAAwLcAAMC4AADAuQAAwLoAAMC7AADAvAAAwL0AAMC+AADAvwAAwMAAAMDBAADAwgAAwMMAAMDEAADAxQAAwMIAAMDGAADAxwAAwMgAAMDJAADAygAAwMsAAMDMAADAzQAAwM4AAMDPAADA0AAAwNEAAMDSAADA0wAAwNQAAMDVAADA1gAAwNcAAMDYAADA2QAAwNIAAMDaAADA2wAAwNwAAMDdAADA3gAAwN8AAMDgAADA4QAAwNgAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADA4gAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwOMAAMDkAADAwgAAwMIAAMDCAADA5QAAwMIAAMDmAADA5wAAwOgAAMDpAADA6gAAwOsAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADA7AAAwO0AAMDCAADA7gAAwO8AAMDCAADA8AAAwPEAAMDyAADA8wAAwPQAAMD1AADA9gAAwPcAAMD4AADAwgAAwPkAAMD6AADA+wAAwPwAAMD9AADA/gAAwP8AAMAAAQDAAQEAwAIBAMADAQDABAEAwAUBAMAGAQDABwEAwAgBAMAJAQDACgEAwAsBAMAMAQDACwEAwA0BAMAOAQDADwEAwAsBAMDCAADAwgAAwMIAAMAQAQDAEQEAwBIBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDAwgAAwMIAAMDCAADAwgAAwBMBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMDCAADAwgAAwBQBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMDCAADAwgAAwBUBAMAWAQDACwEAwAsBAMAXAQDAGAEAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAGQEAwMIAAMDCAADAGgEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMDCAADAGwEAwBwBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMAdAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwB4BAMAfAQDAIAEAwCEBAMAiAQDAIwEAwCQBAMAlAQDA2AAAwNgAAMAmAQDACwEAwAsBAMALAQDACwEAwAsBAMAnAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwCgBAMApAQDACwEAwAsBAMAqAQDACwEAwCsBAMALAQDALAEAwC0BAMAuAQDALwEAwNgAAMDYAADAMAEAwDEBAMAyAQDAMwEAwDQBAMALAQDACwEAwAsBAMALAQDACwEAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMA1AQDAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwDYBAMA3AQDAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAOAEAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMDCAADAwgAAwMIAAMA5AQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDACwEAwAsBAMALAQDAwgAAwMIAAMA6AQDAOwEAwDwB");n(g,128496,"oVcBAEEAAADdVwEAQgAAACZYAQBDAAAAa1gBAEQAAADSWAEARQAAABNZAQBGAAAAfFkBAEcAAACEWQEASAAAADBaAQBJAAAAZ1oBAEoAAADuWgEASwAAAC5bAQBMAAAAcVsBAE0AAADZWwEATgAAAGtcAQBPAAAAh1wBAAgAAADcXAEACQAAAB9dAQAKAAAAZ10BAAsAAACVXQEADAAAAMpdAQANAAAAD14BAA4AAAAqXgEADwAAAIZeAQAPAAAAvV4BABAAAABDXwEAEQAAAH1fAQASAAAAq18BABMAAADZXwEAFAAAAAVgAQAVAAAAMGABABcAAABgYAEAGAAAAHlgAQAZAAAAtWABABsAAADdYAEAHAAAAPBgAQAdAAAAI2EBACAAAABEYQEAIQAAAG9hAQAiAAAAnWEBACMAAADRYQEAJAAAAPNhAQAlAAAAFWIBACYAAABZYgEAKAAAAH1iAQApAAAArmIBACoAAADoYgEAKwAAADVjAQAtAAAAb2MBAC4AAACnYwEALwAAAOZjAQAwAAAAeGQBADEAAACdZAEAMgAAAM9kAQAzAAAA/mQBAGQAAABgZQEAyAAAAN1lAQDJAAAAAAAAAP////8iZgEAAQAAAD5mAQACAAAABVUBAAMAAADNZgEAEQAAADRnAQASAAAAg2cBABMAAAD7ZwEAFAAAADtoAQAVAAAATGgBABYAAAB0aAEAEQAAALdoAQAhAAAAymgBACIAAAD+aAEAIwAAAEtpAQAkAAAAaWkBACUAAACfaQEAJgAAAOJpAQAhAAAAAAAAAP////8AAAAAAAAAACYAAAAAAAAAAQAAAJByAQABAAAAkHMBAAEAAACQdAEAAQAAAJB1AQABAAAAkHYBAAEAAACQdwEAAQAAAJB4AQABAAAAkHkBAAEAAACQegEAAQAAAJB7AQABAAAAkHwBAAEAAACQfQEAAQAAAJB+AQABAAAAkH8BAAEAAACQgAEAAQAAAJCBAQABAAAAkIIBAAUAAAAAAAAABg==");n(g,129280,"oIMBAKCDAQAghAEAIIQBAKCEAQAghQEAoIUBACCGAQCghgEAoIYBACCHAQAghwEAoIcBAKCHAQAgiAEAIIgBAKCIAQCgiAEAIIkBACCJAQAuOU4ycIoBAAMHBQCQigEALjlOLnCKAQADBwUAkIoBAC45Ti5wigEAAwcFAJCKAQAuOVoycIoBAAMJBQCVigEALjlOMnCKAQADBwUAkIoBAC45SjdwigEABAcFAJqKAQAuOUo3cIoBAAQHBQCaigEALjlKN3CKAQAEBwUAmooBAC45TjJwigEAAwcFAJCKAQAuOU4ucIoBAAMHBQCQigEALjlOMnCKAQADBwUAkIoBACIpKSBwigEAAwcFAJqKAQAuOTcycIoBAAMHBQCaigEAo1MBABABAAAAVAEADAEAANJUAQARAQAAClUBACMAAAB/VQEAGwAAADRWAQAVAAAAxVYBAAABAAABVwEAAgEAAE1XAQADAQAAvVcBAAQBAAD7VwEABQEAAE5YAQATAAAAkVgBAB4AAADVWAEAFwAAAF9ZAQAaAAAAkVkBABkAAAD0WQEAGAAAADhaAQAdAAAAzloBABwAAAAPWwEAFgAAADdbAQAU");n(g,129744,"Q1gBABABAACIWAEADAEAAPNYAQARAQAAM1kBACMAAACHWQEAGwAAAOBZAQAVAAAAQloBAAABAACcWgEAAgEAAABbAQADAQAAT1sBAAQBAACnWwEABQEAAEhcAQATAAAAc1wBAB4AAADEXAEAFwAAABVdAQAaAAAAXV0BABkAAACIXQEAGAAAANJdAQAdAAAABF4BABwAAAAvXgEAFgAAAF9eAQAU");n(g,129920,"u08BAAEAAABcUAEAAAAAAM9QAQAAAAAAOFIBAAAAAABBUwEAAAAAAIFTAQAAAAAA+1MBAAAAAADnVAEAAAAAACVVAQAAAAAAiVUBAAAAAABUVgEAAAAAAPxWAQAAAAAADlcBAAAAAABIVwEAAAAAAKdXAQAAAAAA9lcBAAAAAAA3WAEAAAAAAKNYAQAAAAAA6FgBAAAAAAAuWQEAAAAAAH9ZAQAAAAAA61kBAAAAAAD/////g00BAIIAAAB5AAAAdg==");n(g,130128,"4I8BAOCPAQBQkAEAwJABAMCQAQDAkAEAAQAAANQKAwCMCgMAROcC");n(g,130176,"I0sBAAEAAAAAAAAA/////1dMAQABAAAA+0wBAAIAAADGTQEAAwAAAAAAAAD/////Vk4BAAAAAADSTgEAAQAAALJPAQACAAAAGFABABQAAAAAAAAA/////wAAAAAAAAAAt1ABABIAAABNUgEAFAAAAN5SAQAkAAAAhlMBAEAAAAARVAEAwQAAAAAAAAD/////q1QBAAEAAAAAAAAA/////1dMAQAAAAAAGVUBAAEAAACRVQEAAgAAAENWAQADAAAA31YBAAQAAAAgVwEABQAAAAAAAAD/////AAAAAAAAAABXTAEAAQAAAIlXAQACAAAAr1cBAAMAAADfVgEABAAAACBXAQAFAAAAAAAAAP////8AAAAAClgBADxYAQAYUAEAqFgB");n(g,130480,"8l8BAAEAAAA5YAEAAgAAAFhgAQADAAAAgWABAAQAAACwYAEABQAAANNgAQAGAAAABWEBAAcAAAAqYQEACAAAAFFhAQAJAAAAdmEBAAoAAACQYQEACwAAAMNhAQAMAAAA+WEBAA0AAAAuYgEADgAAAE5iAQAPAAAAhmIBAA8AAADUYgEADwAAABljAQAPAAAAP2MBAA8AAACkYwEABwAAANpjAQAHAAAAO2QBAAcAAACEZAEABwAAAK9kAQAHAAAAw2QBAA4AAADnZAEADgAAAAplAQAQAAAA9GUBABAAAAArZgEAEAAAAN9WAQAQAAAAbmYBABAAAADBZgEAEA==");n(g,130752,"f20BAD4AAACjbQEAPOAAAM1tAQAmAAAA1G0BACIAAAA6bgEAIAAAAHhuAQAnAAAAAAAAAP////8AAAAAAAAAAGNnAQBkAAAAxWcBAAAAAAAJaAEAHgAAAEJoAQBBAAAAQ1YBAGQAAACGaAEAlgAAAKVoAQDmAAAAAAAAAP////9jZwEAZAAAAL5oAQA8AAAA6WgBAFAAAABDVgEAZAAAABJpAQB9AAAAUmkBAKAAAAAAAAAA/////wAAAAAAAAAAY2cBAGQAAACUaQEARgAAAN5pAQBVAAAAQ1YBAGQAAAAoagEAbgAAAGdqAQB4AAAAAAAAAP////8AAAAAAAAAAGNnAQBkAAAAlGkBABQAAADeaQEAMgAAAENWAQBkAAAAKGoBAIwAAABnagEAtAAAAAAAAAD/////");n(g,131076,"QP8BAAD/AQCA/wEAwP8B");n(g,131104,"wmoBACDgAAALawEACeAAAEFrAQBf4AAAe2sBACI=");n(g,131152,"q2sBAAEAAAC8awEAAgAAAA1sAQAD");n(g,131184,"+EwBAMJNAQBTTgEACU8BAOVPAQBkUAEA2lABAGdSAQDyUgEA1FMBAGFUAQ==");n(g,131236,"iFIBADlTAQAAAAAAnlMBAGRUAQDwVAEAL1UBAJpVAQBQVgE=");n(g,131280,"Y1IBAIADAACAA/8DbGUAAAcAAAA0UwEAIAQAAAAELwUAAAAAAAAAAHNTAQAwBQAAMAWPBXloAAAEAAAAG1QBAJAFAACQBf8FAAAAAAAAAAC3VAEAAAYAAAAG/wYAAAAAAAAAACpVAQAABwAAAAdPBwAAAAAAAAAAllUBAAAJAAAACX8JaWgAAAQAAAA/VgEAgAkAAIAJ/wluYgAABAAAANZWAQAACgAAAAp/CmFwAAAEAAAAClcBAIAKAACACv8KdWcAAAQAAABfVwEAAAsAAAALfwsAAAAAAAAAAM5XAQCACwAAgAv/C2F0AAAEAAAAD1gBAAAMAAAADH8MZXQAAAAAAAAsWAEAgAwAAIAM/wxuawAABAAAAJ9YAQAADQAAAA1/DWxtAAAEAAAA5FgBAIANAACADf8NaXMAAAQAAAA8WQEAAA4AAAAOfw4AAAAAAAAAAJtZAQCADgAAgA7/DgAAAAAAAAAA8FkBAAAPAAAAD/8PAAAAAAAAAAA0WgEAABAAAAAQnxAAAAAAAAAAANlaAQCgEAAAoBD/EGFrAAAEAAAAGFsBAAARAAAAEf8Rb2sAAAQAAABKWwEAABIAAAASnxMAAAAAAAAAALlbAQAAKAAAACj/KAAAAAAQAAAAWlwBAEAwAABAMP8wAAAAAAgAAACDXAEAADEAAAAx/58AAAAACAAAABhbAQAApwAAAKf/129rAAAM");n(g,131840,"WAIAAKoAAACwBAAAhwAAANAHAABuAAAAuAsAAG4AAAD/////");n(g,131888,"qAsD");n(g,131904,"mF4BAAEAAAA4XwEAAgAAAGFfAQADAAAAnV8BAAYAAADCXwEACQAAAPhfAQAKAAAAJ2ABAAQAAABNYAEABQAAAI1gAQAkAAAAq2ABAAsAAADVYAEADAAAAPZgAQANAAAAFmEBAA4AAABMYQEADwAAAGdhAQAQAAAAlmEBABEAAAC7YQEAEgAAAAJiAQAfAAAAG2IBACUAAABIYgEAIAAAAJJiAQAhAAAAzmIBACIAAADwYgEABwAAAC5jAQAI");n(g,132112,"jmMBAAEAAAC8YwEAAgAAAAAAAAABAAAAFJwBACCcAQAsnAEAPAAAABo=");n(g,132163,"AgMFCAsOEhYbICUrMTc+RUxTWmJpcXmAiJCYn6autbzCyc/V2uDk6e3w9Pb5+/z9/f39/Pv59vTw7enk4NrVz8nCvLWupp+YkIiAeXFpYlpTTEU+NzErJSAbFhIOCwgFAwI=");n(g,132288,"QAAAAAABAAAAAAAA7AQCACcAAAAoAAAAKQAAACoAAAArAAAAQOkBAMO2AQBo6QEAsLYBAOQEAgAAAAAAJAUCACwAAAAtAAAALgAAAC8AAABA6QEAArcBAGjpAQDstgEAEAUCAGjpAQDStgEAGAUCAAU=");n(g,132412,"DQ==");n(g,132436,"CwAAAAoAAADoeAM=");n(g,132460,"Ag==");n(g,132476,"//////////8=");n(g,132544,"MAUCAAAAAAAF");n(g,132564,"MA==");n(g,132588,"CwAAADEAAAD4eAMAAAQ=");n(g,132612,"AQ==");n(g,132628,"/////wo=");n(g,132696,"yAUCAAB/BA==")}var t=new ArrayBuffer(16);var u=new Int32Array(t);var v=new Float32Array(t);var w=new Float64Array(t);function x(y){return u[y]}function z(y,A){u[y]=A}function B(){return w[0]}function C(A){w[0]=A}function D(){throw new Error("abort")}function E(A){v[2]=A}function ya(s){var F=s.a;var G=F.a;var H=G.buffer;var I=new Int8Array(H);var J=new Int16Array(H);var K=new Int32Array(H);var L=new Uint8Array(H);var M=new Uint16Array(H);var N=new Uint32Array(H);var O=new Float32Array(H);var P=new Float64Array(H);var Q=Math.imul;var R=Math.fround;var S=Math.abs;var T=Math.clz32;var U=Math.min;var V=Math.max;var W=Math.floor;var X=Math.ceil;var Y=Math.trunc;var Z=Math.sqrt;var _=F.b;var $=F.c;var aa=F.d;var ba=F.e;var ca=F.f;var da=F.g;var ea=F.h;var fa=F.i;var ga=F.j;var ha=F.k;var ia=F.l;var ja=F.m;var ka=F.n;var la=F.o;var ma=F.p;var na=F.q;var oa=F.r;var pa=F.s;var qa=F.t;var ra=F.u;var sa=294656;var ta=0;var ua=0;var va=0;
      // EMSCRIPTEN_START_FUNCS
      function sd(a){var b=0,c=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,y=0,A=0,D=0,E=0,F=0,G=0,H=0,O=0,R=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0;V=sa-16|0;sa=V;a:{if((a|0)==2){a=0;K[36423]=0;K[50758]=0;K[50757]=0;break a}a=K[33283];if(K[a>>2]==K[a+4>>2]){a=0;I[190280]=0;break a}ab(K[K[32972]+60>>2]);o=K[47192];aa=V+12|0;fa=V+8|0;h=sa-6832|0;sa=h;K[h+6816>>2]=0;K[h+6808>>2]=32;K[h+6800>>2]=0;b:{if(!o){break b}K[47351]=0;K[47350]=0;K[47352]=0;I[189076]=0;a=K[33284];K[47353]=(a|0)>0?a:0;K[47355]=K[47354]+1;A=h+5184|0;Ea(A,0,1600);Z=h+6800|0;f=sa-2608|0;sa=f;K[f+2156>>2]=32;K[f+2148>>2]=0;if(L[134760]){I[190280]=0;I[134760]=0}K[o+8216>>2]=0;K[o+8220>>2]=0;K[o+288>>2]=0;K[h+780>>2]=0;I[189360]=0;a=K[33691];c:{if(a){K[f+2152>>2]=a;break c}d:{e:{b=K[33285];if(!b){a=K[33283];if(K[a>>2]==K[a+4>>2]){K[f+2152>>2]=0;break c}b=K[33285];if(!b){break e}}K[33285]=0;break d}K[33284]=K[33284]+1;a=K[33283];b=wa[K[a+8>>2]](a)|0}K[f+2152>>2]=b}ja=A+2|0;v=32;f:{while(1){u=v;g:{h:{i:{j:{b=K[33691];d=K[33285];if(d){a=0}else{d=K[33285];a=K[33283];a=K[a>>2]==K[a+4>>2]}if(!(b|(!a|d))){if(K[32524]<0){break j}}k:{if(nc(K[f+2156>>2])){break k}a=K[49828];d=(a|0)>0;b=a;a=K[33284];if(d&(b|0)<(a|0)){break i}b=K[49845];if((b|0)<=0|(a|0)<(b|0)){break k}K[49845]=0;I[134760]=1;K[33285]=K[f+2152>>2];c=16384;break f}v=K[f+2156>>2];K[f+2156>>2]=K[f+2152>>2];l:{m:{n:{o:{p:{b=K[32524];if((b|0)>=0){if(L[b+134736|0]){break p}K[32524]=-1}b=K[33285];if(b){break n}a=K[33283];if(K[a>>2]!=K[a+4>>2]){break o}b=32;break l}if(!(K[33691]|b)){K[f+2156>>2]=I[134736];b=1}K[32524]=b+1;b=I[b+134736|0];break l}b=K[33285];if(!b){break m}}K[33285]=0;break l}K[33284]=K[33284]+1;a=K[33283];b=wa[K[a+8>>2]](a)|0}K[f+2152>>2]=b;K[33691]=0;q:{if(i|!K[47203]){break q}r:{a=K[f+2156>>2];if((a|0)!=60){if((b|0)!=35&b-97>>>0>25|(a|0)!=38){break q}d=K[33285];e=0;while(1){s:{K[f+2156>>2]=b;if(!d){a=K[33283];if(K[a>>2]==K[a+4>>2]){break s}b=K[f+2156>>2]}b=(nc(b)|0)!=0;a=K[f+2156>>2];if(!(b|(a|0)==35)|e>>>0>19){break s}I[(f+112|0)+e|0]=a;e=e+1|0;b=K[33285];if(b){K[33285]=0;d=0}else{K[33284]=K[33284]+1;a=K[33283];b=wa[K[a+8>>2]](a)|0;d=K[33285]}continue}break}I[(f+112|0)+e|0]=0;t:{u:{b=K[33285];if(!b){b=0;a=K[33283];if(K[a>>2]==K[a+4>>2]){break t}b=K[33285];if(!b){break u}}K[33285]=0;break t}K[33284]=K[33284]+1;a=K[33283];b=wa[K[a+8>>2]](a)|0}K[f+2152>>2]=b;K[f+100>>2]=K[f+2156>>2];K[f+104>>2]=b;K[f+96>>2]=f+112;Aa(134736,84252,f+96|0);v:{if(K[f+2156>>2]==59){e=f+2156|0;n=f+2152|0;d=sa-32|0;sa=d;b=f+112|0;w:{if(L[b|0]==35){a=b+1|0;if(L[a|0]==120){K[d>>2]=e;a=Ka(b+2|0,90005,d);break w}K[d+16>>2]=e;a=Ka(a,90070,d+16|0);break w}b=ub(130752,b);a=-1;if((b|0)==-1){break w}K[e>>2]=b;if(!K[n>>2]){K[n>>2]=32}a=b}sa=d+32|0;if((a|0)>0){break v}}K[32524]=0;K[f+2156>>2]=38;K[f+2152>>2]=32;break q}a=K[f+2156>>2];if((a|0)>32){break q}b=K[33692]-20|0;if(!b|(b|0)==16){break r}break q}x:{if((b|0)==47){break x}if(pb(b)){break x}a=K[f+2152>>2];if((a|0)==63){break x}if((a|0)!=33){break q}}a=K[f+2148>>2];if((a|0)>780){K[33691]=K[f+2156>>2];a=a+189424|0;I[a|0]=32;I[a+1|0]=0;K[33285]=K[f+2152>>2];c=16384;break f}n=K[33285];e=0;b=K[f+2152>>2];while(1){K[f+2156>>2]=b;d=0;if(!n){a=K[33283];d=K[a>>2]==K[a+4>>2];b=K[f+2156>>2]}if(!((b|0)==62|d|e>>>0>499)){K[(f+144|0)+(e<<2)>>2]=b;e=e+1|0;b=K[33285];if(b){n=0;K[33285]=0;continue}K[33284]=K[33284]+1;a=K[33283];b=wa[K[a+8>>2]](a)|0;n=K[33285];continue}break}d=f+144|0;K[d+(e<<2)>>2]=0;K[f+2152>>2]=32;w=f+2148|0;u=K[32525];b=0;t=sa-560|0;sa=t;y:{if(!Zd(d,84333,3)){break y}if(!Zd(d,84477,4)){break y}a=(d+(_d(d)<<2)|0)-4|0;D=K[a>>2];if((D|0)==47){K[a>>2]=32}while(1){z:{a=K[d+(b<<2)>>2];if(!a){a=b;break z}if(Sa(a)){a=b;break z}I[(t+512|0)+b|0]=xb(a<<24>>24);a=39;b=b+1|0;if((b|0)!=39){continue}}break}I[(t+512|0)+a|0]=0;A:{if(L[t+512|0]==47){b=ub(130480,t+512|1);if((b|0)!=16){e=K[w>>2];K[w>>2]=e+1;I[e+189424|0]=32}n=b+32|0;break A}n=ub(130480,t+512|0);if((n|0)!=16){b=K[w>>2];K[w>>2]=b+1;I[b+189424|0]=32}if((D|0)!=47){break A}b=0;if(!(502241>>>n&1)){break y}}e=d+(a<<2)|0;a=K[33708];i=Q(a,76)+133076|0;b=262174;B:{C:{D:{E:{switch(n-1|0){case 33:F:{if((a|0)<=1){break F}while(1){b=a-1|0;if(K[Q(b,76)+133152>>2]==2){break F}K[33708]=b;d=a>>>0>2;a=b;if(d){continue}break}a=1}b=ob(e,34,a);break y;case 32:G:{if((a|0)<=1){break G}while(1){b=a-1|0;if(K[Q(b,76)+133152>>2]==1){break G}K[33708]=b;d=a>>>0>2;a=b;if(d){continue}break}a=1}b=ob(e,33,a)+524328|0;break y;case 9:b=K[33709];if((b|0)<=18){K[33709]=b+1}i=b<<6;a=i+134912|0;K[a>>2]=10;K[a+4>>2]=-1;K[a+8>>2]=-1;K[a+52>>2]=-1;K[a+56>>2]=-1;K[a+44>>2]=-1;K[a+48>>2]=-1;K[a+36>>2]=-1;K[a+40>>2]=-1;K[a+28>>2]=-1;K[a+32>>2]=-1;K[a+20>>2]=-1;K[a+24>>2]=-1;K[a+12>>2]=-1;K[a+16>>2]=-1;K[a+60>>2]=-1;a=Ra(e,88301);d=Ra(e,88390);H:{if(!Ze(a,88479)){K[(i+134912|0)+24>>2]=Ob(d,130192);break H}if(Ze(a,88528)){break H}K[((b<<6)+134912|0)+28>>2]=Ob(d,130224)}Zb(w,K[33709]);break D;case 2:a=K[33709];if((a|0)<=18){K[33709]=a+1}ga=a<<6;a=ga+134912|0;K[a>>2]=3;K[a+4>>2]=-1;K[a+8>>2]=-1;K[a+52>>2]=-1;K[a+56>>2]=-1;K[a+44>>2]=-1;K[a+48>>2]=-1;K[a+36>>2]=-1;K[a+40>>2]=-1;K[a+28>>2]=-1;K[a+32>>2]=-1;K[a+20>>2]=-1;K[a+24>>2]=-1;K[a+12>>2]=-1;K[a+16>>2]=-1;K[a+60>>2]=-1;R=1;while(1){T=R<<2;d=Ra(e,K[T+130448>>2]);if(d){D=0;a=K[T+131072>>2];n=K[a>>2];I:{if(!n){break I}while(1){b=0;while(1){J:{i=I[b+n|0];u=K[(b<<2)+d>>2];if(!u){break J}b=b+1|0;if((i|0)==(u|0)){continue}}break}K:{switch(u-34|0){case 0:case 5:if(!i){break I}break;default:break K}}D=D+1|0;n=K[a+(D<<3)>>2];if(n){continue}break}}ka=T+(ga+134912|0)|0;a=K[(a+(D<<3)|0)+4>>2];L:{if((a|0)>=0){a=(Q(a,K[(T+134912|0)+4>>2])|0)/100|0;break L}while(1){a=d;d=a+4|0;if(Sa(K[a>>2])){continue}break}ha=K[a>>2]==43;a=a+(ha<<2)|0;ia=K[a>>2]==45;d=(ia<<2)+a|0;i=sa-16|0;sa=i;D=t+96|0;n=sa-224|0;sa=n;Ea(n+16|0,0,144);a=n+160|4;K[n+24>>2]=a;K[n+60>>2]=a;K[n+92>>2]=-1;K[n+64>>2]=60;K[n+20>>2]=a;K[n+48>>2]=19;b=d;while(1){a=b;b=a+4|0;u=K[a>>2];if(u){u=Ta(124960,u)}else{u=0}if(u){continue}break}K[n+100>>2]=a;b=n+16|0;lb(b,0,0);be(n,b,1,1);b=K[n+8>>2];la=K[n+12>>2];u=K[n>>2];ma=K[n+4>>2];if(D){na=D;D=K[n+136>>2]+(K[n+20>>2]-K[n+60>>2]|0)|0;K[na>>2]=D?a+(D<<2)|0:d}a=i;K[a+8>>2]=b;K[a+12>>2]=la;K[a>>2]=u;K[a+4>>2]=ma;sa=n+224|0;s=Wc(K[a>>2],K[a+4>>2],K[a+8>>2],K[a+12>>2]);sa=a+16|0;M:{a=d;d=K[t+96>>2];b=100;N:{if((a|0)==(d|0)){break N}b=ia?-1:ha;O:{a=K[d>>2];if((a|0)!=115){if((a|0)!=37){break O}s=b?+(b|0)*s+100:s;if(S(s)<2147483648){b=~~s;break N}b=-2147483648;break N}if(K[d+4>>2]!=116){break O}H=s*+(b|0)/12;C(+H);a=x(1)|0;x(0)|0;a=a>>>20&2047;b=a-969|0;P:{if(b>>>0>=63){s=H+1;if((b|0)<0){break P}C(+H);b=x(1)|0;d=x(0)|0;Q:{if(a>>>0<1033){break Q}s=0;if(!d&(b|0)==-1048576){break P}s=H+1;if(a>>>0>=2047){break P}if((b|0)>0|(b|0)>=0){a=sa-16|0;P[a+8>>3]=3105036184601418e216;s=P[a+8>>3]*3105036184601418e216;break P}if(b>>>0<3230714880){break Q}a=sa-16|0;P[a+8>>3]=12882297539194267e-247;s=P[a+8>>3]*12882297539194267e-247;break P}i=a;a=b<<1|d>>>31;a=!(d<<1)&(a|0)==-2129002496|a>>>0<2165964800?i:0}s=P[14416];_=s+H;s=H-(_-s);H=s*s;ba=H*H*(s*P[14421]+P[14420]);H=H*(s*P[14419]+P[14418]);s=s*P[14417];C(+_);x(1)|0;i=x(0)|0;d=i<<4&2032;s=ba+(H+(s+P[d+115376>>3]));d=d+115384|0;u=K[d>>2];n=K[d+4>>2];b=u;u=0;d=b+u|0;b=(i<<13)+n|0;b=d>>>0<u>>>0?b+1|0:b;if(!a){R:{if(!(i&-2147483648)){z(0,d|0);z(1,b+-1048576|0);H=+B();s=H*s+H;s=s+s;break R}z(0,d|0);z(1,b+1071644672|0);H=+B();_=H*s;s=_+H;if(s<1){a=sa-16|0;K[a+8>>2]=0;K[a+12>>2]=1048576;P[a+8>>3]=P[a+8>>3]*22250738585072014e-324;ba=s+1;s=ba+(_+(H-s)+(s+(1-ba)))+-1;s=s==0?0:s}s=s*22250738585072014e-324}break P}z(0,d|0);z(1,b|0);H=+B();s=H*s+H}s=s*100;if(S(s)<2147483648){b=~~s;break N}b=-2147483648;break N}if((R|0)!=1){break M}if(!b){s=s*100;if(S(s)<2147483648){b=~~s;break N}b=-2147483648;break N}s=s*+(b|0)*100;S:{if(S(s)<2147483648){a=~~s;break S}a=-2147483648}b=a+100|0}a=(Q(b,K[T+134848>>2])|0)/100|0;break L}if(S(s)<2147483648){a=~~s}else{a=-2147483648}if(!b){break L}a=K[T+134848>>2]+Q(a,b)|0}K[ka+4>>2]=a}R=R+1|0;if((R|0)!=5){continue}break};Zb(w,K[33709]);break D;case 11:b=K[33709];if((b|0)<=18){K[33709]=b+1}a=(b<<6)+134912|0;K[a>>2]=12;K[a+4>>2]=-1;K[a+8>>2]=-1;K[a+52>>2]=-1;K[a+56>>2]=-1;K[a+44>>2]=-1;K[a+48>>2]=-1;K[a+36>>2]=-1;K[a+40>>2]=-1;K[a+28>>2]=-1;K[a+32>>2]=-1;K[a+20>>2]=-1;K[a+24>>2]=-1;K[a+12>>2]=-1;K[a+16>>2]=-1;K[a+60>>2]=-1;a=Ra(e,88658);if(a){a=Ob(a,130400)}else{a=3}d=(b<<6)+134912|0;T:{if(K[K[47192]+148>>2]==1){K[((b<<6)+134912|0)+20>>2]=L[a+102764|0];a=L[a+102770|0];break T}K[((b<<6)+134912|0)+52>>2]=a;a=L[a+102776|0]}K[d+12>>2]=a;Zb(w,K[33709]);break D;case 34:case 41:case 43:a=K[33709];U:{if((a|0)<=0){break U}e=n-32|0;n=0;d=0;b=0;if(a>>>0>=4){i=a&-4;D=0;while(1){u=b|3;R=b|2;T=b|1;d=(e|0)==K[(u<<6)+134912>>2]?u:(e|0)==K[(R<<6)+134912>>2]?R:(e|0)==K[(T<<6)+134912>>2]?T:(e|0)==K[(b<<6)+134912>>2]?b:d;b=b+4|0;D=D+4|0;if((i|0)!=(D|0)){continue}break}}i=a&3;if(i){while(1){d=(e|0)==K[(b<<6)+134912>>2]?b:d;b=b+1|0;n=n+1|0;if((i|0)!=(n|0)){continue}break}}if((d|0)<=0){break U}K[33709]=d;a=d}Zb(w,a);break D;case 7:a=Ra(e,88741);b=Ra(e,88860);if((Ob(a,130176)|0)!=1){break D}a=K[w>>2];K[w>>2]=a+1;I[a+189424|0]=91;a=K[w>>2];K[w>>2]=a+1;I[a+189424|0]=91;a=K[w>>2];a=lc(a+189424|0,b,800-a|0)+K[w>>2]|0;K[w>>2]=a+1;I[a+189424|0]=93;a=K[w>>2];K[w>>2]=a+1;I[a+189424|0]=93;break D;case 35:if(K[33692]==36){I[K[w>>2]+189424|0]=0;a=K[33707];b=a+189424|0;d=ub(131104,b);if(d){K[w>>2]=Pa(d,b)+a}}a=K[w>>2];K[w>>2]=a+1;I[a+189424|0]=1;a=K[w>>2];K[w>>2]=a+1;I[a+189424|0]=89;K[33692]=0;break D;case 8:a=Ra(e,89299);if(!a){break D}I[134824]=1;b=K[w>>2];K[w>>2]=lc(b+189424|0,a,800-b|0)+K[w>>2];break D;case 13:I[134824]=1;break D;case 40:case 45:I[134824]=0;break D;case 4:a=Ra(e,89360);if(!a){break D}lc(t+352|0,a,160);V:{if(!L[t+352|0]){break V}if(Oa(199328,t+352|0)){break V}I[134760]=1;I[199328]=0;b=16384;break y}a=Ad(t+352|0);if((a|0)<0){break D}K[t+20>>2]=a;K[t+16>>2]=1;a=t+352|0;Aa(a,89460,t+16|0);Ca(K[w>>2]+189424|0,a);K[w>>2]=K[w>>2]+Ba(a);break D;case 10:b=K[33709];if((b|0)<=18){K[33709]=b+1}a=(b<<6)+134912|0;K[a>>2]=11;K[a+4>>2]=-1;K[a+8>>2]=-1;K[a+52>>2]=-1;K[a+56>>2]=-1;K[a+44>>2]=-1;K[a+48>>2]=-1;K[a+36>>2]=-1;K[a+40>>2]=-1;K[a+28>>2]=-1;K[a+32>>2]=-1;K[a+20>>2]=-1;K[a+24>>2]=-1;K[a+12>>2]=-1;K[a+16>>2]=-1;K[a+60>>2]=-1;a=Ra(e,89514);W:{if(!a){break W}lc(t+352|0,a,160);X:{if(!K[34441]){Y:{if(!(!u|L[t+352|0]==47)){K[t+48>>2]=u;K[t+52>>2]=t+352;a=t+96|0;Aa(a,89564,t+48|0);a=$e(a);break Y}a=$e(t+352|0)}if((a|0)<0){break W}K[t+36>>2]=a;K[t+32>>2]=1;Aa(t+352|0,89623,t+32|0);break X}a=Ad(t+352|0);if((a|0)<0){break W}if(wa[K[34441]](1,a+K[33282]|0,u)|0){break W}K[t+68>>2]=a;K[t+64>>2]=1;Aa(t+352|0,89658,t- -64|0)}a=t+352|0;Ca(K[w>>2]+189424|0,a);K[w>>2]=K[w>>2]+Ba(a);K[((b<<6)+134912|0)+4>>2]=1}Zb(w,K[33709]);if((D|0)==47){Ye(11,w);b=16384;break y}I[134772]=1;b=16384;break y;case 42:Ye(43,w);I[134772]=0;b=16384;break y;case 12:Z:{a=Ra(e,89714);if(a){b=16384;a=Ob(a,130336);i=(a|0)<0?2:a;if(i>>>0<=2){a=K[w>>2];K[t+84>>2]=i;K[t+80>>2]=1;Aa(a+189424|0,89770,t+80|0);K[w>>2]=K[w>>2]+3;b=0}a=K[(i<<2)+102784>>2];d=Ra(e,89907);if(!d){break Z}break C}b=16384;d=Ra(e,89907);if(d){break C}a=21;break B}if(i>>>0<3){break D}break B;case 0:a=Ra(e,89965);if(a){b=t+352|0;lc(b,a,160);Ad(b)}b=ob(e,1,K[33708])?147456:0;break y;case 1:b=ob(e,2,a)?147456:0;break y;case 5:b=0;if(K[i>>2]==6){b=ob(e,38,a);a=K[33708]}b=(ob(e,6,a)|b)+524358|0;break y;case 6:b=0;d=K[i>>2];if((d|0)==6){b=ob(e,38,a);d=K[i>>2]}if((d|0)==7){b=ob(e,39,K[33708])|b}b=(b|ob(e,7,K[33708]))+524358|0;break y;case 37:b=524328;if(K[i>>2]!=6){break y}b=ob(e,38,a)+524328|0;break y;case 38:b=524358;if((K[i>>2]&-2)!=6){break y}b=ob(e,39,a)+524358|0;break y;case 14:case 46:break y;case 3:break E;default:break D}}a=Ra(e,88893);b=Ra(e,88992);d=Ra(e,89153);e=Ob(a,130272);b=Ob(b,130320);a=Xe(d,0);K[t>>2]=1;d=(a|0)<2?193:a- -64|0;a=(b|0)==1?19:e;b=(a|0)==64?d:a;K[t+4>>2]=b;a=t+352|0;Aa(a,89230,t);Ca(K[w>>2]+189424|0,a);a=K[w>>2]+Ba(a)|0;K[w>>2]=a;K[33707]=a;K[33692]=b}b=0;break y}a=Xe(d,1);d=K[33722];Nc(1,K[33713]);d=(Q(a,d)|0)/100<<8;a=(d|0)/(Q(K[36429],10)|0)|0;if((a|0)<=199){a=(d|0)/(Q(K[36428],10)|0)|0}b=b?b:16384}d=a>>>5|0;e=a;a=(a|0)>4095;b=(a?d>>>0>=4095?4095:d:e)+(a?b|8388608:b)|0}sa=t+560|0;if(b){a=K[f+2148>>2]+189424|0;I[a|0]=32;I[a+1|0]=0;if(!(b&131072)){c=b;break f}Ca(189360,134784);c=b;break f}K[f+2156>>2]=32;_:{$:{b=K[33285];if(!b){i=0;a=K[33283];if(K[a>>2]==K[a+4>>2]){continue}b=K[33285];if(!b){break $}}K[33285]=0;break _}K[33284]=K[33284]+1;a=K[33283];b=wa[K[a+8>>2]](a)|0}K[f+2152>>2]=b;i=0;continue}K[f+2156>>2]=a+57344}if(L[134824]){continue}d=K[f+2156>>2];a=K[f+2152>>2];if(!((a|0)!=10|K[47268]!=-1)){c=Ic(d);aa:{if((c|0)!=16384){a=K[f+2148>>2];break aa}a=K[f+2148>>2];J[A+(a<<1)>>1]=K[33284]-K[47353];K[Z>>2]=a;c=524328;a=Pa(K[f+2156>>2],a+189424|0)+K[f+2148>>2]|0}a=a+189424|0;I[a|0]=32;I[a+1|0]=0;break f}ba:{if((d|0)!=1){break ba}if((a|0)!=66){if((a|0)!=86){break ba}a=K[f+2148>>2];K[f+2148>>2]=a+1;I[a+189424|0]=0;while(1){ca:{da:{ea:{b=K[33285];if(!b){a=K[33283];if(K[a>>2]==K[a+4>>2]){break ca}b=K[33285];if(!b){break ea}}K[33285]=0;break da}K[33284]=K[33284]+1;a=K[33283];b=wa[K[a+8>>2]](a)|0}K[f+2156>>2]=b;if(Sa(b)){break ca}a=K[f+2148>>2];if((a|0)>=799){break ca}K[f+2148>>2]=a+1;I[a+189424|0]=K[f+2156>>2];continue}break}I[K[f+2148>>2]+189424|0]=0;c=147456;break f}b=K[f+2148>>2];a=b+189424|0;I[a|0]=32;I[a+1|0]=32;I[a+2|0]=32;I[a+3|0]=0;K[f+2148>>2]=b+3;fa:{ga:{ha:{ia:{ja:{ka:{b=K[33285];if(!b){a=K[33283];if(K[a>>2]==K[a+4>>2]){break ia}b=K[33285];if(!b){break ka}}K[33285]=0;break ja}K[33284]=K[33284]+1;a=K[33283];b=wa[K[a+8>>2]](a)|0}K[f+2152>>2]=b;d=0;if((b|0)!=48){break ha}break ga}b=K[f+2152>>2]}K[47208]=0;K[47201]=1;if((b|0)==49){break fa}d=K[33285];e=0;while(1){la:{if(!d){a=K[33283];if(K[a>>2]==K[a+4>>2]){break la}b=K[f+2152>>2]}if(Sa(b)|e>>>0>58){break la}K[(e<<2)+188832>>2]=K[f+2152>>2];b=K[33285];ma:{if(b){K[33285]=0;d=0;break ma}K[33284]=K[33284]+1;a=K[33283];b=wa[K[a+8>>2]](a)|0;d=K[33285]}e=e+1|0;K[f+2152>>2]=b;a=K[f+2148>>2];K[f+2148>>2]=a+1;I[a+189424|0]=32;continue}break}d=2;K[(e<<2)+188832>>2]=0}K[47201]=d}na:{b=K[33285];if(!b){a=K[33283];if(K[a>>2]==K[a+4>>2]){continue}b=K[33285];if(!b){break na}}K[33285]=0;K[f+2152>>2]=b;continue}K[33284]=K[33284]+1;a=K[33283];K[f+2152>>2]=wa[K[a+8>>2]](a);continue}W=W+1|0;b=0;a=K[o+340>>2];e=M[a>>1];oa:{if(!e){break oa}while(1){if((e&65535)!=(d|0)){b=b+2|0;e=M[a+(b<<1)>>1];if(e){continue}break oa}break}pa:{a=M[a+(b<<1|2)>>1];switch(a|0){case 1:continue;case 0:break oa;default:break pa}}K[f+2156>>2]=a;d=a}qa:{if(nc(d)){q=1;b=K[f+2156>>2];break qa}if(F){K[33285]=K[f+2152>>2];b=1328;K[f+2156>>2]=1328;K[f+2152>>2]=32;F=0;break qa}b=K[f+2156>>2];if((b|0)==3851){b=32;K[f+2156>>2]=32;F=0;break qa}F=0;if((b|0)!=3405|K[f+2152>>2]!=8205){break qa}b=3406;K[f+2156>>2]=3406}ra:{if(wb(b)){K[o+8216>>2]=K[o+8216>>2]+1;if(K[33692]|K[47200]!=2){break ra}if(wb(v)){break ra}K[f+2544>>2]=0;K[f+2548>>2]=0;K[f+2304>>2]=84731;if(!Wa(o,f+2304|0,f+2160|0,f+2544|0,0,0)){break ra}a=f+2160|0;kb(o,a,f+2544|0,-1,0);b=a;a=f+2336|0;Ab(b,a);K[f+80>>2]=a;b=f+2240|0;Aa(b,85451,f+80|0);a=K[f+2148>>2];b=Ba(b)+a|0;if((b|0)>=800){break ra}Ca(a+189424|0,f+2240|0);K[f+2148>>2]=b;break ra}if(!pb(K[f+2156>>2])){break ra}K[o+8220>>2]=K[o+8220>>2]+1}b=K[f+2152>>2];a=K[f+2156>>2];sa:{if(!K[47204]){break sa}if((i|0)>0){i=i-1|0;break sa}if(!((a|0)!=91|(b|0)!=91)){d=0;i=-1;break g}i=(a|0)==93?(b|0)==93?2:i:i}ta:{if((a|0)!=10){break ta}d=K[33285];e=0;while(1){ua:{if(!d){a=K[33283];if(K[a>>2]==K[a+4>>2]){break ua}b=K[f+2152>>2]}if(!Sa(b)){break ua}e=(K[f+2152>>2]==10)+e|0;b=K[33285];if(b){K[33285]=0;d=0}else{K[33284]=K[33284]+1;a=K[33283];b=wa[K[a+8>>2]](a)|0;d=K[33285]}K[f+2152>>2]=b;continue}break}if((e|0)>0){if(c){a=X+189424|0;Ea(a,32,Ga(f+2336|0,a))}a=K[f+2148>>2]+189424|0;I[a|0]=32;I[a+1|0]=0;K[33285]=K[f+2152>>2];c=K[47203]?524358:Q((e|0)>=3?3:e,30)+524328|0;break f}a=K[47268]<(W|0);W=0;if(a){break ta}a=K[f+2148>>2]+189424|0;I[a|0]=32;I[a+1|0]=0;K[33285]=K[f+2152>>2];c=262174;break f}d=0;if(K[33692]|i){break g}a=0;if(!c){break h}if(Sa(K[f+2156>>2])){a=c;break h}if(Ma(K[f+2156>>2])){if(Sb(K[f+2156>>2])){break h}}K[33691]=K[f+2156>>2];a=X+189424|0;I[a|0]=32;I[a+1|0]=0;K[33285]=K[f+2152>>2];break f}if(F){K[f+2148>>2]=Pa(1328,K[f+2148>>2]+189424|0)+K[f+2148>>2]}if(c){a=X+189424|0;Ea(a,32,Ga(f+2336|0,a))}a=K[f+2148>>2]+189424|0;I[a|0]=32;I[a+1|0]=0}c=589864;break f}b=K[f+2156>>2];va:{if((b|0)!=46|K[f+2152>>2]!=46){break va}wa:{xa:{ya:{b=K[33285];if(!b){b=K[33283];if(K[b>>2]==K[b+4>>2]){break wa}b=K[33285];if(!b){break ya}}K[33285]=0;break xa}K[33284]=K[33284]+1;b=K[33283];b=wa[K[b+8>>2]](b)|0}g=b;if((b|0)!=46){break wa}K[f+2152>>2]=32;K[f+2156>>2]=8230;g=K[33285];while(1){za:{Aa:{if(!g){b=K[33283];if(K[b>>2]==K[b+4>>2]){g=46;break wa}g=K[33285];if(!g){break Aa}}K[33285]=0;b=0;break za}K[33284]=K[33284]+1;b=K[33283];g=wa[K[b+8>>2]](b)|0;b=K[33285]}if((g|0)!=46){break wa}K[f+2152>>2]=32;K[f+2156>>2]=8230;g=b;continue}}b=K[f+2156>>2];if((b|0)==8230){K[f+2152>>2]=g;b=8230;break va}K[33285]=g}D=0;n=Ic(b);Ba:{if((n|0)==16384){break Ba}Ca:{if(!(n&536621)){break Ca}b=K[33285];while(1){if(!b){b=K[33283];if(K[b>>2]==K[b+4>>2]){break Ca}}if(!(Ic(K[f+2152>>2])&536621)){break Ca}g=K[33285];if(g){K[33285]=0;b=0}else{K[33284]=K[33284]+1;b=K[33283];g=wa[K[b+8>>2]](b)|0;b=K[33285]}K[f+2152>>2]=g;continue}}if(n&1048576){K[h+780>>2]=n>>>12&15;F=1;i=0;c=a;continue}Da:{if(Sa(K[f+2152>>2])|n&32768){break Da}if(Qb(K[f+2152>>2])){break Da}b=K[f+2152>>2];if((b|0)==63){break Da}e=0;if(!K[33285]){b=K[33283];e=K[b>>2]==K[b+4>>2];b=K[f+2152>>2]}if(e){break Da}if((b|0)!=1){break Ba}}D=1}b=K[f+2156>>2];if((b|0)==57404){K[f+2156>>2]=60;b=60}Ea:{if(!K[47201]){break Ea}c=0;e=Bb(b);Fa:{if(1<<e&1879048255?e>>>0<=30:0){break Fa}Ga:{e=Bb(b);if(e>>>0>27){break Ga}i=1<<e;if(i&116672){break Fa}if(!(i&134227968)){break Ga}c=!(Rb(b,e)&1024);break Fa}c=1}if(L[134772]|!c){break Ea}if(K[47201]!=1){if(!Ta(188832,K[f+2156>>2])){break Ea}}K[o+288>>2]=0;d=K[f+2156>>2];I[f+2336|0]=0;i=K[f+2152>>2];b=0;c=K[34064];Ha:{Ia:{if((c|0)<=0){break Ia}while(1){if((d|0)==K[(b<<4)+136272>>2]){if(K[(b<<4)+136276>>2]){break Ha}if(xd(0,b)){break Ia}break Ha}b=b+1|0;if((c|0)!=(b|0)){continue}break}}b=-1}Ja:{if((b|0)>=0){K[f>>2]=b;Aa(f+2336|0,86007,f);K[33285]=i;break Ja}Ka:{La:{e=!D;if(e|(d|0)!=46|(i|0)==46){break La}K[f+2600>>2]=0;K[f+2604>>2]=0;K[f+2540>>2]=86036;if(!Wa(o,f+2540|0,f+2544|0,f+2600|0,0,0)){break La}b=f+2544|0;kb(o,b,f+2600|0,-1,0);c=b;b=f+2160|0;Ab(c,b);K[f+64>>2]=b;b=f+2304|0;Aa(b,85451,f- -64|0);break Ka}b=bf(f+2240|0,o,d,0)}c=b;if(e|!K[f+2148>>2]|L[o+76|0]&2){b=K[33285];e=1;while(1){Ma:{Na:{if(!b){b=K[33283];if(K[b>>2]==K[b+4>>2]|(d|0)==60|(d|0)!=(i|0)){break Ma}e=e+1|0;i=K[33285];if(i){break Na}K[33284]=K[33284]+1;b=K[33283];i=wa[K[b+8>>2]](b)|0;b=K[33285];continue}if((d|0)==60|(d|0)!=(i|0)){break Ma}i=b;e=e+1|0}b=0;K[33285]=0;continue}break}K[f+2152>>2]=i;if(D){K[33285]=i}if((e|0)==1){K[f+16>>2]=c;Aa(f+2336|0,86219,f+16|0);break Ja}if((e|0)<=3){I[f+2336|0]=0;b=K[50786];if((b|0)<=299){K[f+2336>>2]=L[86728]|L[86729]<<8|(L[86730]<<16|L[86731]<<24);J[f+2340>>1]=L[86732]|L[86733]<<8}if((e|0)>0){while(1){K[f+32>>2]=c;b=f+2160|0;Aa(b,86219,f+32|0);i=e>>>0>1;Za(f+2336|0,b);e=e-1|0;if(i){continue}break}b=K[50786]}if((b|0)>299){break Ja}K[f+2160>>2]=L[86857]|L[86858]<<8|(L[86859]<<16|L[86860]<<24);b=L[86860]|L[86861]<<8|(L[86862]<<16|L[86863]<<24);I[f+2163|0]=b;I[f+2164|0]=b>>>8;I[f+2165|0]=b>>>16;I[f+2166|0]=b>>>24;Za(f+2336|0,f+2160|0);break Ja}K[f+56>>2]=c;K[f+52>>2]=e;K[f+48>>2]=c;Aa(f+2336|0,86932,f+48|0);break Ja}K[33691]=d;K[33285]=i;J[f+2336>>1]=32}c=f+2336|0;e=Ba(c);b=K[f+2148>>2];Ca(b+189424|0,c);K[f+2148>>2]=b+e;if(D){if((d|0)==45){c=16384;break f}c=Ic(d);if(!(L[o+76|0]&2|(b|0)<=0)){c=(c&-32769)==266270?262148:(c&28672)==4096?266244:262148;break f}if(!(c&524288)){c=(c&28672)==4096?266244:262148;break f}if((c|0)>=0){break f}}d=K[f+2156>>2]}Oa:{if(d|!(n&2097152)){break Oa}b=Ca(K[f+2148>>2]+189424|0,bf(f+2336|0,o,K[f+2156>>2],1));if(!L[b|0]){d=0;break Oa}K[f+2148>>2]=K[f+2148>>2]+Ba(b);n=n&-28673;d=K[f+2156>>2]}i=0;Pa:{if(!D){break Pa}Qa:{g=K[f+2152>>2];if(!Sa(g)){b=0;break Qa}e=K[33285];b=0;while(1){if(!e){c=K[33283];if(K[c>>2]==K[c+4>>2]){break Qa}}if(!Sa(g)){break Qa}b=((g|0)==10)+b|0;g=K[33285];if(g){K[33285]=0;e=0}else{K[33284]=K[33284]+1;c=K[33283];g=wa[K[c+8>>2]](c)|0;e=K[33285]}continue}}i=K[f+2156>>2];c=(i|0)==46?(b|0)<2?n|4194304:n:n;Ra:{if(!b){e=1;Sa:{if((i|0)!=44|(v|0)!=46|(K[o+212>>2]!=26741|u-48>>>0>=10)){break Sa}if(g-48>>>0>=10){if(!Sb(g)){break Sa}}K[f+2156>>2]=1367;e=0}n=K[f+2156>>2];if(!((n|0)!=46|(g|0)!=39)){i=e;n=K[33283];t=K[n>>2];if((t|0)==K[n+4>>2]){e=0}else{e=wa[K[n+8>>2]](n)|0;K[n>>2]=t}n=K[f+2156>>2];e=(e|0)!=115&i}Ta:{if((n|0)==46){Ua:{if(!(I[o+106|0]&1)){break Ua}Va:{if(v-48>>>0<10){break Va}i=v-73|0;if(i>>>0>15|!(1<<i&40969)){break Ua}i=u-73|0;if(1<<i&40969?i>>>0<=15:0){break Va}if(!Sa(u)){break Ua}}if(v-48>>>0>=10){e=0;break Ua}e=!Sb(g)&(g|0)!=45&e}if(Sb(g)){e=L[o+208|0]!=0&e}if(q){n=K[f+2156>>2];break Ta}n=32;K[f+2156>>2]=32;e=0;break Ta}e=e&q}if(!(!e|(n|0)!=46|(!K[47203]|(g|0)!=60))){X=K[f+2148>>2];a=c;break Ra}if(!e){break Ra}}a=K[f+2148>>2]+189424|0;I[a|0]=32;I[a+1|0]=0;K[33285]=g;if(v-48>>>0<10){c=Ma(g)?c:c&-4194305}if((b|0)<2){break f}c=(c|0)==536621?536656:(c|0)==532520?532555:524358;break f}if(!K[33285]){i=0;b=K[33283];if(K[b>>2]==K[b+4>>2]){break Pa}}i=0;if(!Sa(K[f+2152>>2])){break Pa}K[33285]=g}c=a}if(K[33712]==1){continue}b=K[f+2156>>2];Wa:{if((d|0)==(b|0)){Xa:{if(Qb(d)){b=57384}else{b=45;if(K[f+2156>>2]==45){break Xa}b=32}K[f+2156>>2]=b}e=K[f+2148>>2];break Wa}e=K[f+2148>>2];if((b|0)!=57404){break Wa}b=60;K[f+2156>>2]=60}K[f+2148>>2]=Pa(b,e+189424|0)+K[f+2148>>2];Ya:{if(Sa(K[f+2156>>2])){break Ya}if(Qb(K[f+2156>>2])){break Ya}a=K[f+2148>>2];J[A+(a<<1)>>1]=K[33284]-K[47353];if((a|0)<=(e+1|0)){break Ya}Ea(ja+(e<<1)|0,255,a+(e^-1)<<1)}b=K[f+2148>>2];K[Z>>2]=b;Za:{_a:{if((b|0)>725){if(!Ma(K[f+2156>>2])){break _a}b=K[f+2148>>2]}if((b|0)<796){continue}break Za}b=K[f+2148>>2];if(K[f+2156>>2]-48>>>0>=10){break Za}if((b|0)<796){continue}}break}a=b+189424|0;I[a|0]=32;I[a+1|0]=0;K[33285]=K[f+2152>>2];c=16384}sa=f+2608|0;F=c;if(aa){a=K[h+780>>2];K[aa>>2]=a?a:F>>>12&7}a=(h+5184|0)+(K[h+6800>>2]<<1)|0;J[a+6>>1]=0;J[a+2>>1]=0;J[a+4>>1]=32767;n=Q(F&4095,F&8388608?320:10);c=189424;$a:{ab:{a=L[189424];bb:{if(!a){break bb}while(1){a=a<<24>>24;if((a&255)!=0&a>>>0<33){c=c+1|0;a=L[c|0];if(a){continue}break bb}break}if(L[c|0]){break ab}}a=K[47566];b=n-a|0;n=(b|0)>0?b:0;K[47566]=n+a;F=L[190268]?F|524288:F;K[o+8240>>2]=F;break $a}K[47566]=n;a=L[190268];K[o+8240>>2]=F;if(!a){break $a}G=1;K[47568]=K[47568]+1;a=K[47569];if((a|0)<=0){break $a}a=a-1|0;K[47569]=a;if(a){break $a}I[190280]=0}K[49572]=1;K[47572]=655360;K[47573]=0;K[o+8184>>2]=0;K[o+8188>>2]=0;a=0;K[o+288>>2]=0;b=o- -8192|0;K[b>>2]=0;K[b+4>>2]=0;K[o+8200>>2]=0;K[o+8224>>2]=0;K[o+8228>>2]=0;b=o+8232|0;K[b>>2]=0;K[b+4>>2]=0;I[h+786|0]=32;J[h+784>>1]=8192;K[h+6812>>2]=32;J[h+1588>>1]=3;K[h+1584>>2]=0;c=0;b=K[h+6800>>2];cb:{if((b|0)<=0){break cb}while(1){if(J[(h+5184|0)+(c<<1)>>1]>0){break cb}c=c+1|0;if((b|0)!=(c|0)){continue}break}c=b}b=M[(h+5184|0)+(c<<1)>>1];J[h+1592>>1]=b;if(b){while(1){a=((b&65535)!=65535)+a|0;c=c+1|0;b=M[(h+5184|0)+(c<<1)>>1];if(b){continue}break}}I[h+1594|0]=a;e=3;A=1;c=0;while(1){u=K[h+6808>>2];w=(h+784|0)+e|0;mc(h+6808|0,w-1|0);db:{if(!L[o+170|0]|K[h+6808>>2]-48>>>0>=10){break db}if(!Ma(u)){break db}K[h+6808>>2]=97}eb:{if(r){K[h+6812>>2]=r;break eb}if(!k){break eb}mc(h+6812|0,k+189423|0)}b=k;fb:{gb:{hb:{if(c){break hb}b=Ga(h+6816|0,k+189424|0)+k|0;c=K[h+6816>>2];if(c){break hb}K[h+6804>>2]=32;v=1;r=0;q=0;a=32;break gb}a=b+189424|0;q=Ga(h+6804|0,a);if((c|0)==1){d=b-1|0;r=32;v=0;if(K[h+6812>>2]!=32){b=d;a=32;break gb}k=0;c=b;ib:{jb:{switch(L[a|0]-43|0){case 0:c=b+1|0;k=64;break ib;case 2:break jb;default:break ib}}c=b+1|0;k=96}a=c+189424|0;kb:{if(I[a|0]-48>>>0>=10){g=c+1|0;q=-1;break kb}q=Kb(a);while(1){a=c;c=a+1|0;if(I[a+189424|0]-48>>>0<10){continue}break}g=c;c=a}r=K[47350];lb:{if((r|0)>247){a=0;break lb}a=0;c=I[c+189424|0];if((c|0)<0){break lb}c=Wb(84868,c&255,14);if(!c){break lb}a=c-84868|0;b=a+1|0;if((q|0)==-1){q=K[(b<<2)+105536>>2];k=0}mb:{nb:{switch(a-8|0){case 0:K[49574]=0;K[49573]=q;break mb;case 4:break nb;default:break mb}}if((q|0)>=3){I[199304]=1;break mb}I[199304]=0}a=1;K[47350]=r+1;K[(r<<2)+198304>>2]=(b+k|0)+(q<<8);b=g}r=K[h+6812>>2];Ea(d+189424|0,32,b-d|0);$=a+$|0;c=0;break fb}r=0;if(!((c|0)==32|K[49573]!=36)){if(!(K[h+6812>>2]!=32|K[h+6804>>2]!=32)){K[49573]=20}v=0;a=dc(c,o);break gb}v=0;a=c}ob:{if(U){U=1;A=8;c=0;if((a|0)!=93|K[h+6804>>2]!=93){break ob}b=b+1|0;a=32;U=0;break ob}c=K[49573];if((c&240)==64){if(a-48>>>0<10){c=0;g=K[49574]+1|0;d=(g|0)>(K[49573]&15);K[49574]=d?0:g;a=d?32:a;y=d|y;U=0;break ob}c=0;K[49574]=0;d=K[h+6808>>2]-48>>>0<10;a=d?32:a;y=d|y;U=0;break ob}U=0;if(c&16){c=0;break ob}pb:{qb:{rb:{sb:{tb:{g=(a|0)==8242?39:(a|0)==8217?39:(a|0)==146?39:(a|0)==180?39:a;if((g|0)!=8216&(g|0)!=63){break tb}if(!Ma(K[h+6808>>2])){g=a;break tb}g=a;if(!Ma(K[h+6804>>2])){break tb}g=39;break sb}ub:{if((g|0)!=1367){if((g|0)==1328){m=m|1024;g=32;break sb}a=g-44032|0;if(a>>>0>11183){break sb}i=a&65535;c=(i>>>0)/28|0;d=(c>>>0)%21|0;a=a-Q(c,28)&65535;if(g-50500>>>0>587){break ub}c=a?a+4519|0:0;d=d+4449|0;break qb}m=m|131072;X=K[h+6804>>2];a=K[h+6812>>2];g=32;break rb}c=(a+Q(d,28)|0)+50500|0;d=(i>>>0)/588|4352;break qb}X=K[h+6804>>2];a=K[h+6812>>2];c=g-12592|0;if(c>>>0>51){break rb}d=L[c+103296|0]|4352;c=0;break qb}f=b+189424|0;vb:{c=K[o+212>>2];if((c|0)!=28268&(c|0)!=24934|(g|0)!=39){break vb}if(pb(a)){break vb}Ga(h+6820|0,f+1|0);if(!Pb(K[h+6820>>2])){break vb}d=601;c=0;wb:{switch(X-110|0){case 6:break qb;case 0:break wb;default:break vb}}if(K[o+212>>2]!=24934){break qb}I[f|0]=32;break qb}K[h+6824>>2]=32;a=K[49897];xb:{if((a|0)>0){K[49897]=a-1;c=0;break xb}if(!g){c=0;d=0;break pb}yb:{zb:{Ab:{D=K[o+180>>2];Bb:{if(!D){break Bb}i=g;t=wb(g);if(t){i=dc(g,o)}if(Tc(D)){break Bb}while(1){K[h+16>>2]=0;K[h+624>>2]=i;a=Ga(h+16|0,D)+D|0;Cb:{if(K[h+624>>2]!=K[h+16>>2]){break Cb}if(L[a|0]){d=1;R=0;c=f;while(1){T=Ga(h+16|0,a);W=Ga(h+624|0,c);Z=dc(K[h+624>>2],o);K[h+624>>2]=Z;c=c+W|0;W=(Z|0)==K[h+16>>2];R=W+R|0;d=d&W;a=a+T|0;if(L[a|0]){continue}break}if(!d){break Cb}K[49897]=R}a=a+1|0;if(!a){break Bb}if(L[188788]&8){K[h>>2]=D;K[h+4>>2]=a;Na(K[47195],85187,h)}a=Ga(h+6828|0,a)+a|0;if(L[a|0]){break Ab}c=0;break zb}while(1){c=a;a=a+1|0;if(L[c|0]){continue}break}while(1){a=c;c=a+1|0;if(L[c|0]){continue}break}D=a+2|0;if(!Tc(D)){continue}break}}c=0;d=g;break yb}Ga(h+6824|0,a);Db:{if(!t){break Db}if(!wb(X)){break Db}K[h+6824>>2]=Vc(K[h+6824>>2])}c=K[h+6824>>2]}d=K[h+6828>>2];m=m|2097152;if(t){d=Vc(d)}}if((d|0)!=8){break qb}}d=b;break fb}if(!c){c=0;break pb}K[h+6804>>2]=c}Eb:{if(Ma(d)){break Eb}if(Pb(d)){break Eb}if(Ta(K[o+336>>2],d)){break Eb}if(!Ma(K[h+6808>>2])|!(!L[o+170|0]|d-48>>>0>=10)&K[h+6804>>2]-48>>>0>=10){break Eb}d=32;y=1}Fb:{Gb:{Hb:{Ib:{Jb:{Kb:{if(K[h+6808>>2]-48>>>0<10){if(d-48>>>0<10){a=l;break Jb}a=d-32|0;if(1<<a&20481?a>>>0<=14:0){break Ib}y=1;break Kb}a=0;if(K[h+6812>>2]!=44){break Jb}a=l;if((d|0)!=44){break Jb}}d=32;break Ib}Lb:{if((d|0)!=91){break Lb}g=K[h+6804>>2];if((g|0)==2){break Hb}d=91;if((g|0)!=91){break Lb}if(K[47204]){break Hb}}l=a}if(Ma(d)){Mb:{Nb:{Ob:{Pb:{if(!Ma(K[h+6808>>2])){a=K[h+6808>>2];break Pb}if(!L[o+171|0]){break Ob}a=K[h+6808>>2];if((d|0)>12352){break Pb}if((a|0)<12353){break Ob}}Y=Ta(K[o+336>>2],a)?Y:0;Qb:{a=K[h+6808>>2];if((a|0)==32){break Qb}if(Ta(K[o+336>>2],a)){break Qb}a=32;p=Qb(K[h+6808>>2])?p:p|256;break Nb}m=wb(d)?m|2:m;if(K[h+6808>>2]!=32|I[w-2|0]-48>>>0>=10|K[h+6812>>2]-48>>>0<10){break Ob}I[(h+784|0)+e|0]=32;a=(Q(E,12)+h|0)+1588|0;J[a>>1]=M[a>>1]+1;e=e+1|0}a=32;if((d|0)==32){break Mb}Y=Y+1|0;g=K[o+600>>2];if((g|0)<=0){a=d;break Mb}Rb:{i=K[h+6808>>2];if((d|0)<=591&(i|0)>=(g|0)){break Rb}if((d|0)<(g|0)){a=d;break Mb}if((Y|0)<2){a=d;break Mb}if((i|0)<=591){break Rb}a=d;break Mb}if(!Ma(i)){a=d;break Mb}m=m|16384;p=p|128}y=1}ca=ca+1|0;if(wb(a)){g=dc(a,o);if(K[o- -64>>2]){a=da?g:712;c=da?c:g;da=1;break ob}if(Sb(K[h+6812>>2])){if(K[h+6808>>2]==32){a=g;break ob}a=32;if(K[o+212>>2]!=26465){break Fb}d=85240;i=(h+784|0)+e|0;q=0;while(1){Sb:{f=Ba(d);u=i-f|0;if(L[u|0]!=32){break Sb}f=f-1|0;if($a(u+1|0,d,f)){break Sb}d=I[d+f|0];if((d|0)==(g|0)){a=g;break ob}if((d|0)!=65){break Sb}if(!Nd(o,g)){break Sb}a=g;break ob}q=q+1|0;d=K[(q<<2)+131184>>2];if((q|0)!=11){continue}break}break Fb}a=32;if((g|0)==32){break ob}if(!wb(K[h+6812>>2])){a=g;break ob}if(!Sb(K[h+6804>>2])){a=g;break ob}Ga(h+16|0,(b+q|0)+189424|0);if(!(K[o+212>>2]!=28268|(Y|0)!=2|(g|0)!=106|K[h+6812>>2]!=73)){a=g;break ob}if(K[h+6808>>2]==32){a=g;break ob}if(!Ma(K[h+16>>2])){a=g;break ob}p=p|256;r=32;y=1;break ob}if(!A){A=0;break ob}if((Y|0)<3){A=0;break ob}if((a|0)!=115){A=0;break ob}if(K[o+212>>2]!=25966){A=0;break ob}if(K[h+6804>>2]!=32){A=0;break ob}A=A|4;a=32;d=e+h|0;if(L[d+783|0]!=39){break ob}I[d+783|0]=32;break ob}a=32;Tb:{Ub:{Vb:{Wb:{Xb:{switch(d-39|0){default:if((d|0)==95){break ob}case 1:case 2:case 3:case 4:case 5:if(d-48>>>0>=10){break Tb}Yb:{if(!L[o+170|0]){break Yb}if(!Ma(K[h+6808>>2])){break Yb}g=K[h+6804>>2];if(!(g-48>>>0<10|g-2406>>>0<10)){break Tb}}i=K[h+6808>>2];if((i|0)==32){break Ub}g=K[h+6808>>2];if(i-48>>>0<10){break Vb}i=g;g=K[o+128>>2];if((i|0)==(g|0)){break Wb}y=1;break ob;case 6:Zb:{if(Pb(K[h+6812>>2])){break Zb}if(!Ma(K[h+6804>>2])){break Zb}if(K[h+6808>>2]!=32){y=1;break ob}m=m|128;if((E|0)<=0){break ob}d=(Q(E,12)+h|0)+1572|0;K[d>>2]=K[d>>2]|16384;break ob}d=K[h+6804>>2];if(!(K[h+6812>>2]!=32|(d|0)!=32)){O=4;break ob}if((d|0)==45){b=b+1|0;O=4;break ob}a=45;if(K[h+6808>>2]!=32){break ob}if(!Ma(u)){break ob}if(Ma(K[h+6812>>2])){break ob}I[(h+784|0)+e|0]=32;d=(Q(E,12)+h|0)+1588|0;J[d>>1]=M[d>>1]+1;e=e+1|0;break ob;case 7:if(K[h+6808>>2]==46){y=1;break ob}a=46;if((E|0)<=0){break ob}d=(Q(E,12)+h|0)+1572|0;if(I[d+1|0]&1){break ob}if(!Ma(K[h+6812>>2])){break ob}K[d>>2]=K[d>>2]|65536;a=Pb(K[h+6804>>2]);a=a?32:K[h+6804>>2]==45?32:46;break ob;case 0:break Xb}}g=K[h+6812>>2];_b:{$b:{if((g|0)==46){d=115;if(K[h+6804>>2]==115){break $b}}if(!nc(g)){break _b}d=K[h+6804>>2]}if(Ma(d)){break Gb}}d=K[o+88>>2];if(d&1){if(Ma(K[h+6804>>2])){break Gb}d=K[o+88>>2]}if(d&2){if(Ma(K[h+6812>>2])){break Gb}}if(!(!Ta(K[o+332>>2],K[h+6812>>2])|(u|0)!=32)){b=(K[h+6804>>2]==32)+b|0;break Gb}d=K[h+6808>>2];g=(d|0)!=115|ea;ea=0;if(!(g&1)){break ob}ea=(Pb(d)|0)!=0;O=4;break ob}if((g|0)==44&l){y=1;break ob}l=1;break Tb}if((g|0)!=32){break Tb}}if(!Ma(u)){break Tb}if(Ma(K[h+6812>>2])){break Tb}I[(h+784|0)+e|0]=32;a=(Q(E,12)+h|0)+1588|0;J[a>>1]=M[a>>1]+1;e=e+1|0}a=d;break ob}U=1;d=b+1|0;l=a;break fb}a=39;ea=0;break ob}y=1;r=32}ac:{if(Pb(a)){if(K[h+6808>>2]==32){m=m|262144;d=b;break fb}d=K[h+6816>>2]-9>>>0<2;i=y&1;if(i){q=0;a=b-1|0;bc:{if((j|0)>(a|0)){break bc}while(1){g=J[(h+5184|0)+(a<<1)>>1];if(!g){break bc}q=((g|0)>0)+q|0;a=a-1|0;if((j|0)<=(a|0)){continue}break}}I[(Q(E,12)+h|0)+1594|0]=q}p=d?p|262144:p;I[(h+784|0)+e|0]=32;a=e+1|0;cc:{if((E|0)>298){break cc}d=(h+1584|0)+Q(E,12)|0;g=M[d+4>>1];if((g|0)>=(a|0)){break cc}if(($|0)<=0){j=K[d>>2]}else{j=(K[47350]<<2)+198300|0;K[j>>2]=K[j>>2]|128;$=0;j=K[d>>2]|64}f=K[47352];I[d+6|0]=f;K[d>>2]=j|((ca?A:A&-2)|(L[199304]?2048:0))|m;if((f|0)>0){while(1){j=h+784|0;m=j+a|0;a=a-1|0;j=j+a|0;I[m|0]=L[j|0];if((a|0)>(g|0)){continue}break}I[j|0]=32;J[d+4>>1]=g+1;a=e+2|0}E=E+1|0;g=(h+1584|0)+Q(E,12)|0;K[g>>2]=0;J[g+4>>1]=a;e=b;d=K[h+6800>>2];dc:{if((d|0)<=(b|0)){break dc}while(1){if(J[(h+5184|0)+(e<<1)>>1]>0){break dc}e=e+1|0;if((d|0)!=(e|0)){continue}break}e=d}q=M[(h+5184|0)+(e<<1)>>1];J[g+8>>1]=q;ca=0;d=0;if(q){while(1){d=((q&65535)!=65535)+d|0;e=e+1|0;q=M[(h+5184|0)+(e<<1)>>1];if(q){continue}break}}I[g+10|0]=d;K[47352]=0;A=1;m=p;p=0;da=0}y=0;c=i?0:c;d=i?k:b;break ac}if((e|0)>795){d=b;b=j;a=e;break ac}a=Pa(a,(h+784|0)+e|0)+e|0;d=b;b=j}if(K[47352]<(O|0)){K[47352]=O}O=0;j=b;e=a}if(!v){k=d;if((e|0)<799){continue}}break}if(!(($|0)<=0|E)){a=(K[47350]<<2)+198300|0;K[a>>2]=K[a>>2]|128;K[h+1584>>2]=K[h+1584>>2]|64;E=1}a=(h+784|0)+e|0;K[o+8204>>2]=a-1;b=0;I[a|0]=0;I[h+1590|0]=0;I[(Q(E,12)+h|0)+1590|0]=8;ec:{if((E|0)<=0){K[h+1584>>2]=K[h+1584>>2]|512;e=K[49572];break ec}a=E-1|0;fc:{if((E|0)==1){break fc}c=a;while(1){if(!Qb(I[M[(Q(c,12)+h|0)+1588>>1]+(h+784|0)|0])){b=c;break fc}g=(c|0)>1;c=c-1|0;if(g){continue}break}}b=(h+1584|0)+Q(b,12)|0;K[b>>2]=K[b>>2]|16;gc:{if(!(F&4194304)){break gc}a=(h+1584|0)+Q(a,12)|0;b=K[a>>2];if(b&256){break gc}K[a>>2]=b|65536}K[h+1584>>2]=K[h+1584>>2]|512;e=K[49572];if((E|0)<=0|(e|0)>990){break ec}a=h+624|0;g=a|3;i=a|2;r=h+754|0;v=!(F&4194304);k=0;j=0;while(1){K[47354]=K[47354]+1;hc:{ic:{jc:{a=K[49827];if((a|0)<=0){break jc}a=a-1|0;K[49827]=a;if(a){break jc}I[190280]=0;break ic}if(L[190280]){break hc}}a=M[(Q(k,12)+h|0)+1588>>1]+(h+784|0)|0;kc:{if(I[a|0]-48>>>0>=10){break kc}b=h+624|0;c=a;if(K[o+112>>2]==1227133512){break kc}while(1){lc:{mc:{if(I[c|0]-48>>>0<10){I[b|0]=L[c|0];b=b+1|0;c=c+1|0;break mc}if(K[o+124>>2]!=I[c|0]|L[c+1|0]!=32){break lc}e=c+2|0;if(L[c+3|0]==32|I[e|0]-48>>>0>=10|L[c+4|0]==32){break lc}k=k+1|0;c=e}if(b>>>0<r>>>0){continue}break kc}break}e=c-a|0;l=h+624|0;b=b-l|0;c=e-b|0;Ea(a+b|0,32,c>>>0<=e>>>0?c:0);Fa(a,l,b)}b=0;while(1){c=b;b=b+1|0;if(I[a+c|0]-48>>>0<10){continue}break}nc:{if(c-5>>>0<=27){I[h+626|0]=32;J[h+624>>1]=8224;if(!(L[a|0]!=48&K[o+132>>2]>=(c|0))){b=(h+1584|0)+Q(k,12)|0;K[b>>2]=K[b>>2]|524288}p=(h+1584|0)+Q(k,12)|0;q=0;e=g;while(1){oc:{b=a;a=I[a|0];if(a-48>>>0>=10&(a|0)!=K[o+128>>2]){break oc}I[e|0]=a;a=e+1|0;l=c;c=c-1|0;pc:{if((c|0)<=0){e=a;break pc}if(!(K[o+112>>2]>>>c&1)){e=a;break pc}f=K[p+4>>2];m=(h+16|0)+Q(q,12)|0;K[m>>2]=K[p>>2];K[m+4>>2]=f;K[m+8>>2]=K[p+8>>2];q=q+1|0;m=K[o+124>>2];if((m|0)!=32){I[e+1|0]=m;a=e+2|0}I[a|0]=32;e=a+1|0;if(L[p+2|0]&8){break pc}O=K[o+112>>2];if(O>>>l-2&1){I[a+1|0]=48;I[a+2|0]=48;O=K[o+112>>2];e=a+3|0}if(!(O>>>l-3&1)){break pc}I[e|0]=48;e=e+1|0}a=b+1|0;if(e>>>0<r>>>0){continue}}break}c=K[p+4>>2];a=(h+16|0)+Q(q,12)|0;K[a>>2]=K[p>>2];K[a+4>>2]=c;c=K[p+20>>2];K[a+16>>2]=K[p+16>>2];K[a+20>>2]=c;c=K[p+12>>2];K[a+8>>2]=K[p+8>>2];K[a+12>>2]=c;c=1;if((q|0)>0){while(1){a=(h+16|0)+Q(c,12)|0;K[a>>2]=K[a>>2]&-262209;c=c+1|0;if((q|0)>=(c|0)){continue}break}}a=L[b+4|0]|L[b+5|0]<<8|(L[b+6|0]<<16|L[b+7|0]<<24);c=L[b|0]|L[b+1|0]<<8|(L[b+2|0]<<16|L[b+3|0]<<24);I[e|0]=c;I[e+1|0]=c>>>8;I[e+2|0]=c>>>16;I[e+3|0]=c>>>24;I[e+4|0]=a;I[e+5|0]=a>>>8;I[e+6|0]=a>>>16;I[e+7|0]=a>>>24;a=L[b+12|0]|L[b+13|0]<<8|(L[b+14|0]<<16|L[b+15|0]<<24);b=L[b+8|0]|L[b+9|0]<<8|(L[b+10|0]<<16|L[b+11|0]<<24);I[e+8|0]=b;I[e+9|0]=b>>>8;I[e+10|0]=b>>>16;I[e+11|0]=b>>>24;I[e+12|0]=a;I[e+13|0]=a>>>8;I[e+14|0]=a>>>16;I[e+15|0]=a>>>24;I[e+16|0]=0;if(e>>>0<=g>>>0){break nc}a=L[p+6|0];q=0;c=g;while(1){j=qd(o,c,(h+16|0)+Q(q,12)|0,a&255);while(1){a=L[c|0];c=c+1|0;if((a|0)!=32){continue}break}a=0;I[p+6|0]=0;q=q+1|0;if(c>>>0<e>>>0){continue}break}break nc}K[47352]=0;b=(h+1584|0)+Q(k,12)|0;j=qd(o,a,b,L[b+6|0]);c=K[47352];if((c|0)>L[b+18|0]){I[b+18|0]=c;K[47352]=0}if(!(!(j&4096)|L[a|0]==32)){while(1){Ea(h+624|0,0,150);K[h+624>>2]=538976288;K[h+628>>2]=538976288;I[h+632|0]=32;c=Ga(h+16|0,a);qd(o,Fa(i,a,c),b,0);a=a+c|0;if(L[a|0]!=32){continue}break}}if(!(j&50331648)){break nc}a=v|((K[33264]^-1)+E|0)!=(k|0);n=a?n:10;if(a|!aa){break nc}K[aa>>2]=4;n=10}if(!(j&128)){break hc}b=K[33264];if((b|0)<=0){break hc}a=0;c=b;e=b&3;if(e){while(1){l=(h+1584|0)+Q(c+k|0,12)|0;K[l>>2]=K[l>>2]|1048576;c=c-1|0;a=a+1|0;if((e|0)!=(a|0)){continue}break}}if(b>>>0>=4){while(1){a=(h+1584|0)+Q(c+k|0,12)|0;K[a>>2]=K[a>>2]|1048576;b=a-12|0;K[b>>2]=K[b>>2]|1048576;b=a-24|0;K[b>>2]=K[b>>2]|1048576;a=a-36|0;K[a>>2]=K[a>>2]|1048576;c=c-4|0;if(c){continue}break}}K[33264]=c}e=K[49572];k=k+1|0;if((E|0)<=(k|0)){break ec}if((e|0)<991){continue}break}}c=K[47351];g=K[47350];if((c|0)<(g|0)){r=K[47202];v=K[49846];q=K[47352];while(1){b=K[(c<<2)+198304>>2];a=b>>8;qc:{rc:{switch((b&31)-9|0){case 0:r=a;break qc;case 4:v=a;break qc;case 3:break rc;default:break qc}}q=b>>>0>=256?a+q|0:0}c=c+1|0;if(!(b&128)&(g|0)>(c|0)){continue}break}K[47352]=q;K[47351]=c;K[49846]=v;K[47202]=r}K[49572]=e+2;a=(e<<3)+190288|0;K[a>>2]=589824;J[a+4>>1]=d;K[a+8>>2]=589824;J[a+12>>1]=d;b=E?K[47199]?n:10:10;if(K[33285]){a=0}else{a=K[33283];a=K[a>>2]==K[a+4>>2]}n=a?b:n;k=G;g=0;E=0;i=sa-32192|0;sa=i;K[i+24>>2]=0;K[i+28>>2]=0;K[i+16>>2]=0;K[i+20>>2]=0;K[i+8>>2]=0;K[i+12>>2]=0;K[i>>2]=0;K[i+4>>2]=0;d=K[49572];f=M[(d<<3)+190284>>1];c=d-3|0;sc:{tc:{if((c|0)<0){a=c;break tc}while(1){uc:{a=(c<<3)+190288|0;b=L[a+3|0]&127;g=(b|0)<(g|0)?g:b;if(M[a+4>>1]){a=c;break uc}a=-1;b=(c|0)>0;c=c-1|0;if(b){continue}}break}if(g>>>0>3){break sc}}while(1){a=a-1|0;if((a|0)<0){break sc}b=(a<<3)+190288|0;if(L[b|0]&64){I[b+3|0]=4;break sc}if(L[b+3|0]<4){continue}break}}a=K[o+292>>2];c=0;vc:{if((d|0)<=0){g=0;break vc}l=-1;g=0;while(1){b=a;if(K[o+292>>2]!=(a|0)){a=(c<<3)+190288|0;J[a>>1]=M[a>>1]|32}if((g|0)>0){j=(c<<3)+190288|0;p=K[j+4>>2];a=c-g<<3;e=a+190288|0;K[e>>2]=K[j>>2];K[e+4>>2]=p;if((l|0)!=-1){J[(a+190288|0)+4>>1]=l}l=-1}e=c<<3;wc:{if(L[(e+190288|0)+2|0]==21){j=e+190288|0;a=L[j+7|0];if(L[j|0]&2){break wc}xc:{if((a|0)==(b|0)){break xc}j=L[(e+190288|0)+10|0]-9|0;if(j){if((j|0)==12){break xc}else{break wc}}if(L[(e+190288|0)+18|0]!=21){break wc}}if((l|0)==-1){a=M[(e+190288|0)+4>>1];l=a?a:-1}g=g+1|0}a=b}c=c+1|0;if((d|0)!=(c|0)){continue}break}}K[49572]=d-g;ab(a);b=K[o+36>>2];yc:{if(!b){break yc}g=K[49572];a=g-1|0;if((a|0)<0){break yc}r=b&256;m=b&4;v=b&8;p=b&15;y=b&16;G=b&2;b=b>>>8&1;c=0;while(1){e=g;d=c;g=a;A=a<<3;j=A+190288|0;a=L[j+2|0];if((a|0)==21){zc:{Ac:{c=e-2|0;if((c|0)>=0){while(1){a=c<<3;if(L[(a+190288|0)+2|0]==21){break Ac}a=(c|0)>0;c=c-1|0;if(a){continue}break}}a=K[o+292>>2];break zc}a=L[(a+190288|0)+7|0]}ab(a);a=L[j+2|0]}a=K[((a&255)<<2)+144464>>2];c=d;Bc:{if(!a){break Bc}c=b;if(L[j|0]&32){break Bc}c=L[a+11|0];l=0;Cc:{if(!G){break Cc}e=L[a|0];if((e|0)!=118&(e|0)!=82){break Cc}d=y?0:d;l=1}Dc:{Ec:{Fc:{Gc:{e=c&253;switch(e-4|0){case 1:break Fc;case 0:break Gc;default:break Ec}}if(p){c=1;if(!d){break Dc}}c=d;if((c|0)!=2){break Dc}c=2;a=L[a+13|0];if(!a){break Dc}I[j+2|0]=a;break Dc}if(p){c=2;if(!d){break Dc}}c=d;if((c|0)!=1){break Dc}c=1;a=L[a+13|0];if(!a){break Dc}I[j+2|0]=a;break Dc}c=0;if(!v){break Dc}c=e?d:0}a=l?0:c;c=a;if(!M[(A+190288|0)+4>>1]){break Bc}a=m?0:a;c=a;if(!r){break Bc}c=a?a:1}a=g-1|0;if((a|0)>=0){continue}break}}ab(K[o+292>>2]);Hc:{if(K[49572]<=0){y=-2;c=0;break Hc}c=-1;d=0;j=0;v=0;while(1){a=j<<3;if((c|0)!=-1){J[(a+190288|0)+4>>1]=c}l=a+190288|0;if(L[l+2|0]==21){ab(L[(a+190288|0)+7|0])}p=K[49572];Ic:{Jc:{e=a+190288|0;if(L[e|0]&32){break Jc}b=p-1|0;d=(b|0)>(j|0)?K[(L[(a+190288|0)+10|0]<<2)+144464>>2]:d;Kc:{if(!(M[e+12>>1]|(b|0)==(j|0))){q=0;if(L[d+11|0]|!d){break Kc}}q=1}g=L[l+2|0];y=K[49848];Lc:{if((y|0)<=0){break Lc}b=a+190288|0;c=0;while(1){Mc:{r=Q(c,3);if(L[r+199408|0]!=(g&255)){break Mc}m=L[(r+199408|0)+2|0];if(m&(q^1)|(L[b+3|0]&4?m&2:0)|(M[b+4>>1]?0:m&4)){break Mc}g=L[(r+199408|0)+1|0];I[l+2|0]=g;if(!(L[K[(g<<2)+144464>>2]+4|0]&2)|L[b+3|0]<2){break Lc}I[b+3|0]=0;break Lc}c=c+1|0;if((y|0)!=(c|0)){continue}break}}if(g&255){break Jc}c=M[(a+190288|0)+4>>1];break Ic}c=K[e+4>>2];a=(i+32|0)+(v<<5)|0;b=K[e>>2];K[a>>2]=b;K[a+4>>2]=c;b=K[(b>>>14&1020)+144464>>2];K[a+8>>2]=b;I[a+17|0]=L[b+11|0];v=v+1|0;c=-1}j=j+1|0;if((v|0)<1e3&(p|0)>(j|0)){continue}break}g=0;c=0;y=v-2|0;if((y|0)<=0){break Hc}while(1){Nc:{if(M[((i+32|0)+(g<<5)|0)+4>>1]){b=(g|0)>(y|0)?g:y;c=0;a=g;while(1){Oc:{if((a|0)==(b|0)){a=b;break Oc}d=i+32|0;e=L[(d+(a<<5)|0)+3|0];c=(c|0)>(e|0)?c:e;a=a+1|0;if(!M[(d+(a<<5)|0)+4>>1]){continue}}break}if((a|0)<=(g|0)){break Nc}b=(g^-1)+a|0;d=0;e=a-g&7;if(e){while(1){I[((i+32|0)+(g<<5)|0)+6|0]=c;g=g+1|0;d=d+1|0;if((e|0)!=(d|0)){continue}break}}if(b>>>0<7){break Nc}while(1){b=(i+32|0)+(g<<5)|0;I[b+6|0]=c;I[b+38|0]=c;I[b+70|0]=c;I[b+102|0]=c;I[b+134|0]=c;I[b+166|0]=c;I[b+198|0]=c;I[b+230|0]=c;g=g+8|0;if((g|0)!=(a|0)){continue}break}break Nc}a=g+1|0}g=a;if((y|0)>(a|0)){continue}break}}K[i+40>>2]=K[36125];ab(K[o+292>>2]);u=(c|0)<4;j=1;r=1;p=0;b=0;c=0;G=0;while(1){Pc:{Qc:{Rc:{Sc:{Tc:{if(!b){if((c|0)>=(y|0)|(G|0)>=997){break Sc}g=c<<5;d=g+(i+32|0)|0;e=L[d+2|0];a=K[(e<<2)+144464>>2];K[d+8>>2]=a;l=M[d+4>>1];if((e|0)==21){ab(L[(g+(i+32|0)|0)+7|0])}j=l?c:j;q=K[(L[d+34|0]<<2)+144464>>2];K[d+40>>2]=q;l=c;break Tc}a=i+32|0;l=c-1|0;d=a+(l<<5)|0;p=L[(a+(c<<5)|0)+2|0];if((l|0)>0){c=(j|0)>0;a=j-c|0;g=c?j:2;if(l>>>0>=g>>>0){while(1){c=(i+32|0)+(g<<5)|0;e=c-32|0;j=K[c+12>>2];K[e+8>>2]=K[c+8>>2];K[e+12>>2]=j;j=K[c+4>>2];K[e>>2]=K[c>>2];K[e+4>>2]=j;j=K[c+28>>2];K[e+24>>2]=K[c+24>>2];K[e+28>>2]=j;j=K[c+20>>2];K[e+16>>2]=K[c+16>>2];K[e+20>>2]=j;g=g+1|0;if((l|0)>=(g|0)){continue}break}}j=a}q=K[(p<<2)+144464>>2];K[d>>2]=0;K[d+4>>2]=0;K[d+24>>2]=0;K[d+28>>2]=0;K[d+16>>2]=0;K[d+20>>2]=0;K[d+8>>2]=0;K[d+12>>2]=0;I[d+2|0]=b;a=K[(b<<2)+144464>>2];K[d+8>>2]=a;p=d}if(!a){b=0;c=l+1|0;continue}bb(o,256,d,i+32040|0,i);c=K[i+32052>>2];if((c|0)>0){g=(i+32|0)+(l<<5)|0;q=K[(c<<2)+144464>>2];K[g+40>>2]=q;I[g+34|0]=c;I[g+49|0]=L[q+11|0]}c=0;Uc:{if(b){b=a;break Uc}g=K[i+32056>>2];if((g|0)<=0){b=a;break Uc}b=K[(g<<2)+144464>>2];K[d+8>>2]=b;c=L[d+2|0];I[d+2|0]=g;g=M[d>>1];Vc:{if(L[b+11|0]==2){J[d>>1]=g|4;if(L[a+11|0]==2){break Vc}I[d+3|0]=0;break Vc}J[d>>1]=g&65531}bb(o,256,d,i+32040|0,i)}e=K[i+32048>>2];Wc:{if((e|0)<=0){g=b;break Wc}g=K[(e<<2)+144464>>2];I[d+2|0]=e;K[d+8>>2]=g;a=L[g+11|0];v=1;if((e|0)==1){A=(a|0)==2;break Qc}e=M[d>>1];Xc:{if((a|0)==2){J[d>>1]=e|4;if(L[b+11|0]==2){break Xc}I[d+3|0]=0;break Xc}J[d>>1]=e&65531}bb(o,256,d,i+32040|0,i)}A=0;a=L[g+11|0];if((a|0)!=2){v=0;break Qc}A=1;v=0;a=2;if(L[d+3|0]>1){E=0;break Qc}e=d+3|0;E=E+1|0;b=d;m=K[o+12>>2];Yc:{if(m&8){while(1){Zc:{m=b;b=b+32|0;switch(L[m+49|0]){case 0:break Qc;case 2:break Zc;default:continue}}break}b=m+35|0;if(L[b|0]>1){break Qc}if(L[d+6|0]<=3){I[e|0]=0}if(L[m+38|0]<4){break Yc}break Qc}if(E&1|(E|0)<2){break Qc}if(m&2){break Rc}if(u){b=e;break Yc}b=e;if(M[d+36>>1]){break Rc}}I[b|0]=0;break Qc}K[36423]=G+2;a=(G<<5)+145840|0;J[a>>1]=0;I[a+2|0]=9;I[a+20|0]=2;K[a+12>>2]=n;J[a+4>>1]=f;I[a+17|0]=0;I[a+18|0]=0;K[a+8>>2]=K[36125];J[a+32>>1]=0;I[a+34|0]=9;I[a+52|0]=0;K[a+44>>2]=0;J[a+36>>1]=0;I[a+49|0]=0;I[a+50|0]=0;K[a+40>>2]=K[36126];ab(K[o+292>>2]);sa=i+32192|0;break Pc}E=1}b=M[d+32>>1];_c:{if(!(b&8)|(l|0)<=0){break _c}e=L[q+11|0];if(e>>>0>15|!(1<<e&457)){break _c}c=L[q+10|0];J[d+32>>1]=b^8}t=M[d+36>>1];$c:{if(!t){break $c}b=K[o+4>>2];ad:{if(!b){break ad}bd:{switch(a|0){default:c=b&512?11:c;break;case 0:break ad;case 2:break bd}}if(L[q+11|0]!=2){break ad}e=b&12;cd:{if(!e){break cd}if((e|0)==12){c=11;break cd}c=23}dd:{if(!A){break dd}ed:{switch(b&3){case 2:c=10;break dd;case 0:break dd;default:break ed}}c=23}if(L[d+35|0]<4){break ad}c=b&256?10:c}if((d|0)==(p|0)|(G|0)<=0){break $c}fd:{gd:{hd:{b=K[o>>2]&7;switch(b|0){case 0:break fd;case 1:break hd;default:break gd}}if(c-12>>>0>4294967293){break fd}}c=L[b+101916|0]}c=K[47205]>0?24:c}K[d+72>>2]=K[(L[d+66|0]<<2)+144464>>2];b=K[i+32060>>2];b=c?c:b?b:c;if(!v){m=G<<5;e=m+145840|0;I[e+17|0]=a;K[e+8>>2]=g;I[e+16|0]=0;J[e>>1]=M[d>>1];I[e+3|0]=L[d+3|0]&15;I[e+6|0]=L[d+6|0];c=L[d+7|0];J[e+4>>1]=0;I[e+7|0]=c;v=L[g+10|0];I[e+2|0]=v;c=M[d+4>>1];id:{if(c){J[e+4>>1]=c;d=m+145840|0;k=k&1?5:1;I[d+20|0]=k;c=r;r=0;if(!c){k=0;break id}I[d+20|0]=k|8;k=0;break id}I[(m+145840|0)+20|0]=0}c=m+145840|0;K[c+12>>2]=K[i+32084>>2]<<1;jd:{if(!t|(v|0)!=24){break jd}d=K[47205];if((d|0)<=0){break jd}K[e+8>>2]=K[36126];K[c+12>>2]=Q(d,14)}if((1<<a&428?a>>>0<=8:0)|L[g+7|0]&2){K[c+12>>2]=128;I[e+16|0]=0}a=m+145840|0;I[a+21|0]=255;I[a+22|0]=255;J[a+18>>1]=5120;G=G+1|0}c=l+1|0;continue}break}J[88922]=1;K[44462]=0;if($){J[(K[36423]<<5)+145776>>1]=2;a=(K[47350]<<2)+198304|0;K[a>>2]=128;a=a-4|0;K[a>>2]=K[a>>2]|128}I[190268]=F>>>19&1;if(!fa){break b}K[fa>>2]=F<<14>>31&189360}sa=h+6832|0;y=K[47192];A=K[V+12>>2];b=0;e=0;j=0;m=0;p=0;O=0;n=0;f=sa-6e3|0;sa=f;G=K[36423];d=G-1|0;kd:{if((d|0)<=0){break kd}while(1){I[(f+Q(b,6)|0)+2|0]=0;a=b<<5;ld:{if(L[a+145840|0]&4){c=f+Q(m,6)|0;I[c+1|0]=0;a=a+145840|0;I[c+3|0]=L[a+49|0];a=L[a+3|0];I[c|0]=a;m=m+1|0;O=(a>>>0>3)+O|0;break ld}if(L[K[(a+145840|0)+8>>2]+10|0]!=27|(m|0)<=0){break ld}a=(f+Q(m,6)|0)-4|0;I[a|0]=L[a|0]|4}b=b+1|0;if((d|0)!=(b|0)){continue}break}I[f+Q(m,6)|0]=0;if(!m){break kd}md:{if(K[y+148>>2]==1){nd:{if((G|0)<=0){break nd}a=G&-2;c=G&1;b=145840;while(1){j=L[b+17|0]==2?L[b+3|0]>3?e:j:j;j=L[b+49|0]==2?L[b+35|0]>3?e|1:j:j;b=b- -64|0;e=e+2|0;p=p+2|0;if((a|0)!=(p|0)){continue}break}if(!c|L[b+17|0]!=2){break nd}j=L[b+3|0]>3?e:j}a=j<<5;g=a+145840|0;I[g+3|0]=7;od:{if(K[y+212>>2]!=30313){break od}a=a+145840|0;if(L[a+7|0]){break od}I[a+7|0]=eb(55);G=K[36423]}if((G|0)<=0){break kd}p=0;b=145840;a=145840;l=K[36125];e=l;d=0;r=1;while(1){pd:{if(L[b+17|0]){k=K[36125];break pd}k=K[36125];c=L[K[b+8>>2]+14|0]>50;l=c?k:l;r=c|r}c=L[b+20|0]?k:e;qd:{if(!(L[b|0]&4)){e=c;break qd}k=L[b+7|0];e=K[(k<<2)+144464>>2];m=K[y+212>>2];rd:{if((m|0)==6840683){if(K[c>>2]!=49){break rd}m=K[e>>2]-49|0;if(m>>>0>5|!(1<<m&41)){break rd}I[a+7|0]=eb(50);m=K[y+212>>2]}if((m|0)!=6516078&(m|0)!=31336){break rd}m=0;if(!k){m=d|r;d=eb(m&1?13621:12593);I[b+7|0]=d;e=K[(d<<2)+144464>>2]}if(!((j|0)!=(p|0)|(K[e>>2]|1024)!=13621)){I[g+3|0]=6}if(K[l>>2]==3420466){I[a+7|0]=eb(K[e>>2]==3420466?13619:12594)}sd:{if(K[c>>2]==12597){k=K[e>>2];if((k|0)!=12597){break sd}I[a+7|0]=eb(13109)}k=K[e>>2]}d=m;if((k|0)==12593){k=K[l>>2];if((k|0)==13621){I[b+7|0]=eb(12850);k=K[l>>2]}if((k|0)==13619){I[b+7|0]=eb(13107);k=K[l>>2]}if((k|0)==3420466){I[b+7|0]=eb(13364)}I[b+3|0]=0}}r=0;l=e;a=b}b=b+32|0;p=p+1|0;c=K[36423];if((p|0)<(c|0)){continue}break}break md}a=K[y+152>>2];u=(a|0)>7?1:a;a=y+Q(u,6)|0;o=L[(u?a+637|0:y+157|0)|0];F=L[(u?(a+A|0)+636|0:(y+A|0)+156|0)|0];I[133068]=(A|0)==4;td:{if((m|0)<=0){break td}v=m-1|0;q=A-1>>>0>1;c=0;d=0;while(1){h=f+Q(d,6)|0;a=L[h|0];n=(a<<24>>24>3)+n|0;ud:{if((a|0)!=6){a=c;break ud}a=d-3|0;b=d;vd:{while(1){if((b|0)<=(c|0)|(a|0)>=(b|0)){break vd}wd:{b=b-1|0;g=f+Q(b,6)|0;switch(L[g|0]-4|0){case 2:break vd;case 0:break wd;default:continue}}break}I[g|0]=3}b=d;xd:{while(1){b=b+1|0;if((m|0)<=(b|0)){break xd}yd:{switch(L[f+Q(b,6)|0]-4|0){case 0:break xd;case 2:break yd;default:continue}}break}I[h+2|0]=2;I[h|0]=5;a=c;break ud}if(L[h|0]!=6){a=c;break ud}I[h+2|0]=2;i=0;a=d+1|0;zd:{if((m|0)<=(a|0)){g=d;U=0;break zd}U=1;e=I[f+Q(a,6)|0];if((e|0)>4){g=d;break zd}j=(O-n|0)>1;g=d;while(1){b=a;Ad:{if((e&255)!=4){break Ad}a=j+1|0;j=1;if((a|0)<=1){break Ad}a=b;break zd}a=b+1|0;U=(m|0)>(a|0);if((a|0)!=(m|0)){g=b;e=I[f+Q(a,6)|0];if((e|0)>4){break zd}continue}break}g=v;a=m}e=-1;k=0;j=0;r=-1;p=0;l=-1;b=c;Bd:{if((b|0)<(a|0)){while(1){l=I[f+Q(b,6)|0];t=(l|0)>3;e=t?(e|0)<0?b-c|0:e:e;p=(j|0)>(l|0);i=p?i:(j|0)<(l|0)?b:k;r=t?b:r;k=p?k:b;t=(b|0)!=(g|0);j=p?j:l;b=b+1|0;if(t){continue}break}p=k;l=r;if((e|0)>=0){break Bd}}e=a;k=p;r=l}K[33269]=g-k;K[33268]=e;K[33270]=k;K[33271]=i;Cd:{if(L[133068]){K[33270]=a;K[33271]=a;break Cd}if((r|0)>=0){if((a|0)!=(m|0)){break Cd}I[f+Q(r,6)|0]=7;break Cd}I[f+Q(k,6)|0]=7}Mc(f,u,c,a,F);if(!U&(A|0)!=0){break ud}if(!q){F=L[y+157|0];break ud}F=L[y+156|0]}Dd:{if((a|0)>=(d|0)){c=a;break Dd}if(!(L[h+2|0]&4)){c=a;break Dd}c=d+1|0;e=-1;r=0;k=0;j=0;b=a;i=-1;while(1){g=I[f+Q(b,6)|0];p=(g|0)>3;e=p?(e|0)<0?b-a|0:e:e;l=(g|0)<(j|0);r=l?r:(g|0)>(j|0)?b:k;i=p?b:i;k=l?k:b;p=(b|0)!=(d|0);j=l?j:g;b=b+1|0;if(p){continue}break}K[33269]=d-k;K[33270]=k;K[33271]=r;K[33268]=(e|0)<0?c:e;Ed:{if(L[133068]){K[33270]=c;K[33271]=c;break Ed}if((i|0)>=0){I[f+Q(i,6)|0]=7;break Ed}I[f+Q(k,6)|0]=7}Mc(f,u,a,c,o)}d=d+1|0;if((m|0)!=(d|0)){continue}break}if((c|0)>=(m|0)){break td}e=-1;r=0;k=0;j=0;b=c;i=-1;while(1){a=I[f+Q(b,6)|0];g=(a|0)>3;e=g?(e|0)<0?b-c|0:e:e;d=(a|0)<(j|0);r=d?r:(a|0)>(j|0)?b:k;i=g?b:i;k=d?k:b;j=d?j:a;b=b+1|0;if((m|0)!=(b|0)){continue}break}K[33270]=k;K[33271]=r;K[33269]=(k^-1)+m;K[33268]=(e|0)<0?m:e;Fd:{if(L[133068]){K[33270]=m;K[33271]=m;break Fd}if((i|0)>=0){I[f+Q(i,6)|0]=7;break Fd}I[f+Q(k,6)|0]=7}Mc(f,u,c,m,F)}if((G|0)<=0){break kd}b=0;p=0;while(1){g=b<<5;c=g+145840|0;l=c;a=f+Q(p,6)|0;e=L[a|0];I[c+3|0]=e;if(L[c|0]&4){d=g+145840|0;c=L[a+4|0];I[d+21|0]=c;j=L[a+5|0];I[d+16|0]=0;I[d+22|0]=j;k=L[a+2|0];Gd:{if(k&1){a=2}else{if(e>>>0<6){break Gd}a=L[a+1|0]}I[d+16|0]=a}Hd:{if(c>>>0<=(j&255)>>>0){a=j;j=c;break Hd}I[d+21|0]=j;I[d+22|0]=c;a=c}c=L[(g+145840|0)+7|0];if(c){a=(a&255)+(j&255)>>>1|0;c=K[(c<<2)+144464>>2];I[d+22|0]=a+L[c+13|0];I[d+21|0]=a+L[c+12|0]}if(k&2){I[l+3|0]=e|8}p=p+1|0}b=b+1|0;if((G|0)!=(b|0)){continue}break}break kd}e=0;b=145840;if((c|0)<=0){break kd}while(1){if(L[b|0]&4){a=L[b+7|0];if(!a){I[b+7|0]=17;a=17}a=K[(a<<2)+144464>>2];I[b+21|0]=L[a+12|0];I[b+22|0]=L[a+13|0]}b=b+32|0;e=e+1|0;if((c|0)!=(e|0)){continue}break}}sa=f+6e3|0;p=K[47192];b=0;q=0;i=0;n=0;f=sa-160|0;sa=f;if(K[36423]>=2){A=K[30450];e=1;while(1){a=e;e=a+1|0;j=a<<5;d=j+145840|0;m=L[d+3|0];k=M[d>>1];if(k&2){while(1){g=K[(n<<2)+198304>>2];Id:{if((g&31)!=2){break Id}jd(g&127,g>>>8|0);K[36432]=110;K[36433]=100;K[36434]=450;K[36430]=5;k=K[50786];l=K[32972];c=K[l+84>>2];if((c|0)>0){k=(Q(c,k)|0)/100|0}c=(k|0)>=359?359:k;r=L[((c|0)<=80?80:c)+101856|0];c=(k|0)>=450?450:k;c=(c|0)>399?6:(c|0)>379?7:r;K[32526]=(Q(c,K[l+72>>2])|0)/256;K[32527]=(Q(c,K[l+76>>2])|0)/256;K[32528]=(Q(c,K[l+80>>2])|0)/256;if(c>>>0>7){break Id}l=c-1|0;K[32528]=l;K[32526]=c;K[32527]=l}n=n+1|0;if(!(g&128)){continue}break}k=M[d>>1]}l=e<<5;r=a-1|0;c=m&7;Jd:{Kd:{Ld:{Md:{Nd:{Od:{Pd:{Qd:{Rd:{Sd:{F=L[(j+145840|0)+17|0];g=k&4?2:F;switch(g|0){case 2:break Nd;case 3:case 8:break Od;case 5:break Pd;case 6:case 7:break Qd;case 4:break Rd;case 0:break Sd;default:break Jd}}b=0;break Jd}a=L[((r<<5)+145840|0)+17|0];Td:{if((a|0)==6){c=25;I[(j+145840|0)+18|0]=25;break Td}c=(a|0)==4?60:K[34063]>0?48:c>>>0<4?48:60;I[(j+145840|0)+18|0]=c}if(!(!(L[p|0]&16)|!L[(j+145840|0)+20|0])){I[(j+145840|0)+18|0]=60;c=60}if(L[K[(j+145840|0)+8>>2]+6|0]&64){c=c+30|0;I[(j+145840|0)+18|0]=c}b=0;if(!(k&8)){break Jd}I[(j+145840|0)+18|0]=L[p+164|0]+c;break Jd}a=j+145840|0;d=L[a+20|0];if(!(!d|I[K[a+8>>2]+7|0]&1&L[((r<<5)+145840|0)+17|0]==2)){I[(j+145840|0)+18|0]=15}c=L[(l+145840|0)+17|0];if(!(L[K[(j+145840|0)+8>>2]+4|0]&8|(c|L[((r<<5)+145840|0)+17|0]!=8))){I[(j+145840|0)+18|0]=25}a=r<<5;if(L[K[(a+145840|0)+8>>2]+5|0]&64){I[(j+145840|0)+18|0]=30}if(!(!d|!(K[p>>2]&16))){I[(j+145840|0)+18|0]=30}Ud:{if(!(L[(l+145840|0)+20|0]|(!(L[K[(j+145840|0)+8>>2]+4|0]&32)|(c|0)!=4))){d=j+145840|0;if(L[(a+145840|0)+17|0]==2){K[d+12>>2]=200;break Ud}K[d+12>>2]=150;break Ud}K[(j+145840|0)+12>>2]=256}if((g|0)!=7){break Jd}q=(c|0)==2|q;if((L[(a+145840|0)+17|0]&254)!=2){break Jd}K[(j+145840|0)+12>>2]=K[(a+145840|0)+12>>2]+255>>>1;break Jd}a=r<<5;c=L[(a+145840|0)+17|0];if((c&254)==6|(c|0)==3|K[K[(a+145840|0)+8>>2]+4>>2]&32){I[(j+145840|0)+18|0]=30}d=L[(l+145840|0)+17|0];Vd:{if((d&254)!=2){break Vd}q=(L[(l+145840|0)+20|0]?(d|0)!=2:0)?q:1;d=j+145840|0;I[d+18|0]=40;m=0;Wd:{Xd:{switch(c|0){case 0:a=K[(a+145840|0)+12>>2];if(a>>>0>39){break Wd}m=40-a|0;break Wd;case 2:break Wd;default:break Xd}}if(L[(j+145840|0)+20|0]){break Vd}m=20;Yd:{switch(c-3|0){case 1:m=0;if(!(L[K[(a+145840|0)+8>>2]+4|0]&8)){break Wd}break Vd;case 0:break Wd;case 5:break Yd;default:break Vd}}m=12}I[d+18|0]=m}if(!(L[p|0]&16)|!L[(j+145840|0)+20|0]){break Jd}a=j+145840|0;if(L[a+18|0]>19){break Jd}I[a+18|0]=20;break Jd}d=L[p+296|0];c=j+145840|0;g=c;K[c+12>>2]=256;I[c+19|0]=d;Zd:{if(!L[c+20|0]){break Zd}k=25;_d:{switch(L[((r<<5)+145840|0)+17|0]-2|0){case 0:k=12;if(I[K[(j+145840|0)+8>>2]+7|0]&1){break Zd}break;case 1:break _d;default:break Zd}}I[(j+145840|0)+18|0]=k}l=L[(l+145840|0)+17|0];if((l|0)==2){i=1;break Jd}d=j+145840|0;I[d+22|0]=b;c=r<<5;if((L[(c+145840|0)+17|0]&254)==2){break Md}c=b;g=K[36423];if((g|0)<=(a|0)){break Kd}while(1){c=a<<5;if(L[(c+145840|0)+17|0]==2){c=L[(c+145840|0)+22|0];I[d+22|0]=c;break Kd}a=a+1|0;if((g|0)!=(a|0)){continue}break}break Ld}y=j+145840|0;v=c^c>>>0<2;G=m&8;c=G?25:L[(v+p|0)+296|0]-i|0;I[y+19|0]=c;$d:{if((K[36423]-3|0)>(a|0)){break $d}g=c&255;c=K[p+52>>2];if((g|0)<=(c|0)){break $d}I[y+19|0]=c}c=0;m=0;k=L[d+52|0];if(!k){while(1){g=K[d+40>>2];m=L[d+49|0]==2?((K[g+4>>2]^-1)>>>20&1)+m|0:m;c=L[g+10|0]==27?2:c;g=d;d=d+32|0;k=L[g+84|0];if(!k){continue}break}}g=y+96|0;u=a+2<<5;a=u+145840|0;K[34063]=m;h=L[K[d+40>>2]+10|0];l=l+145840|0;ae:{if(!(L[(u+145840|0)+17|0]|L[K[l+8>>2]+10|0]!=23)){d=j+145968|0;break ae}d=g;g=a;a=l}l=L[K[g+8>>2]+15|0];be:{if(!m){o=K[p+100>>2];u=L[K[a+8>>2]+15|0];d=L[a+20|0];l=L[o+(u+Q(d|L[g+20|0]?(l|0)==1:l,10)|0)|0];if(!d|!(L[p|0]&32)){break be}l=L[(o+Q(u,10)|0)+1|0]+l>>>1|0;break be}l=L[K[p+96>>2]+(L[K[a+8>>2]+15|0]+Q(l,10)|0)|0];if(L[a+17|0]!=8|(L[g+17|0]&254)!=4){break be}l=L[K[d+8>>2]+4|0]&8?l-15|0:l}d=k>>>1|0;u=!m;l=(Q(K[(m?(m|0)==1?4:8:0)+130104>>2],l)|0)/128|0;k=(l|0)<=8?8:l;ce:{if((v|0)==7){l=K[p+200>>2];k=l+k|0;if(!G){break ce}k=((l|0)/2|0)+k|0;break ce}if(!G){break ce}k=K[p+200>>2]+k|0}l=d&u|(h|0)==27;d=M[(p+(v<<1)|0)+304>>1];if(!d){d=M[p+316>>1]}k=Q(d<<16>>16,k);d=j+145840|0;m=L[d+7|0];de:{if(!m){break de}v=L[K[(m<<2)+144464>>2]+14|0];if(!v){break de}k=(Q(k,v)|0)/100|0}ee:{if((l|(c|0)==2)!=1){break ee}c=K[p+12>>2];if(c&2097152){break ee}k=(Q(c&262144?282:((280-(L[K[(j+145840|0)+8>>2]+14|0]<<1)|0)/3|0)+256&65535,k)|0)/256|0}v=j+145840|0;c=Q(K[32526],K[p+196>>2]);G=(F|0)!=2?256:(((c|0)>(k|0)?k:c)|0)/128|0;K[v+12>>2]=G;c=L[v+16|0];if(c>>>0>=19){bd(84371,28,A);I[v+16|0]=0;m=L[d+7|0];c=0}k=c+1|0;c=m&255;fe:{if(c){ud(c,f+8|0);c=wd(K[f+132>>2]);break fe}c=K[((k&255)<<2)+129280>>2]}l=j+145840|0;if((i|q)&1){j=r<<5;d=j+145840|0;i=L[c|0];c=L[l+21|0];c=((Q(i,L[l+22|0]-c|0)|0)/256|0)+c|0;I[d+22|0]=c;b=(c|0)==255?255:b;b=(c-b|0)>16?c-16|0:b;I[d+21|0]=b;d=0;if((b|0)<(c|0)){I[v+16|0]=k;d=2}b=j+145840|0;K[b+12>>2]=G;I[b+16|0]=d;c=L[y+19|0];I[b+19|0]=L[b+17|0]!=3?c>>>0>18?18:c:c}b=(F|0)!=2;c=M[a>>1];d=c&-2;J[a>>1]=d;ge:{he:{ie:{switch(L[a+17|0]-3|0){case 5:if(L[g+17|0]==2){break ge}d=c|1;break he;case 0:break ie;default:break ge}}J[a>>1]=c|1;if(L[g+17|0]==2){break he}if(K[K[a+8>>2]>>2]!=12146){break ge}}J[a>>1]=d}je:{if(!b){c=L[l+22|0];d=L[l+21|0];break je}a=b<<4;c=L[l+22|0];d=L[l+21|0];if((a|0)<=(c-d|0)){break je}a=c-a|0;d=(a|0)>0?a:0;I[l+21|0]=d}a=d&255;b=((Q(L[K[(L[v+16|0]<<2)+129280>>2]+127|0],c-a|0)|0)/256|0)+a|0;i=0;q=0;break Jd}d=K[(c+145840|0)+12>>2];K[g+12>>2]=d;if((F|0)==3){d=K[32526];K[g+12>>2]=d}c=b;ke:{switch(l-5|0){case 0:K[g+12>>2]=(Q(d,160)>>>0)/100;break Ld;case 2:break ke;default:break Kd}}K[g+12>>2]=(Q(d,120)>>>0)/100}c=b}q=0;a=j+145840|0;I[a+16|0]=0;d=a;a=c&255;c=a-16|0;I[d+21|0]=a>>>0>=c>>>0?c:0}if(K[36423]>(e|0)){continue}break}}sa=f+160|0;d=K[47197];le:{if(!(d&15|K[36456])){break le}a=0;g=0;c=sa-80|0;sa=c;me:{ne:{b=K[33222];if(b){break ne}K[33223]=500;b=Qa(500);K[33222]=b;if(b){break ne}K[33223]=0;b=86135;break me}oe:{if((K[36423]-2|0)<2){break oe}a=d>>8;p=d&128?0:a;m=a&d<<24>>31;l=d&2;d=c+32|1;j=1;while(1){r=j<<5;e=r+145840|0;Eb(c,K[e+8>>2],e,l,c+72|0);a=c+32|0;b=L[e+20|0];if((b&13)==1){I[c+32|0]=32;a=d}pe:{if(!p|(p|0)!=32&(b|0)!=0|j>>>0<2){break pe}Ga(c+76|0,c);if(K[c+76>>2]-880>>>0>4294967103){break pe}a=Pa(p,a)+a|0}qe:{if(!(L[e|0]&4)){break qe}b=L[(r+145840|0)+3|0];if(b>>>0<2){break qe}b=b>>>0>=5?5:b;b=l?b>>>0>3?712:716:I[b+94144|0];K[c+76>>2]=b;a=Pa(b,a)+a|0}k=0;K[c+72>>2]=0;b=c;if(L[b|0]){while(1){b=Ga(c+76|0,b)+b|0;re:{if(K[c+72>>2]>>>k-1&1|(!m|(k|0)<=0)){break re}i=K[c+76>>2];if(i-880>>>0>4294967103){break re}if(!uc(i)){break re}a=Pa(m,a)+a|0}k=k+1|0;a=Pa(K[c+76>>2],a)+a|0;if(L[b|0]){continue}break}}se:{if(L[K[e+8>>2]+10|0]==21){break se}b=M[e>>1];if(b&8){a=Eb(a,K[36128],e,l,0);b=M[e>>1]}if(!(!(b&4)|L[(r+145840|0)+17|0]==2)){a=Eb(a,K[36136],e,l,0)}b=L[(r+145840|0)+7|0];if(!b){break se}a=Eb(a,K[(b<<2)+144464>>2],e,l,0)}e=a-(c+32|0)|0;a=e+g|0;te:{if(a>>>0<N[33223]){b=K[33222];break te}b=a+500|0;K[33223]=b;b=yb(K[33222],b);if(!b){K[33223]=0;b=86135;break me}K[33222]=b}k=e;e=c+32|0;I[k+e|0]=0;Ca(b+g|0,e);g=a;j=j+1|0;if((j|0)<(K[36423]-2|0)){continue}break}if(b){break oe}b=86135;break me}I[a+b|0]=0}sa=c+80|0;if(L[188788]&15){K[V>>2]=b;Na(K[47195],84367,V)}a=K[36456];if(!a){break le}wa[a|0](b)|0}if(L[190280]){K[36423]=0;a=1;break a}Te(0);a=K[V+8>>2];ue:{if(a){b=sa+-64|0;sa=b;La(b,a,60);Cc(b,1);a=Lb(b,0);c=0;ve:{if(!a){break ve}c=a;if(!L[202976]){break ve}c=Lb(202976,2)}sa=b- -64|0;K[44468]=c;break ue}c=K[44468]}a=1;if(!c){break a}b=K[32972];c=Qa(1344);if(c){b=Fa(c,b,1344);c=(K[50758]<<4)+216192|0;K[c>>2]=11;K[c+8>>2]=b;b=K[50758]+1|0;K[50758]=(b|0)<=169?b:0}K[44468]=0}sa=V+16|0;return a}function Rb(a,b){var c=0,d=0,e=0,f=0;c=1073741825;a:{b:{c:{d:{e:{f:{g:{h:{i:{j:{k:{l:{m:{n:{o:{p:{q:{r:{s:{t:{u:{v:{w:{x:{y:{z:{A:{B:{C:{D:{E:{F:{G:{H:{I:{J:{K:{L:{M:{N:{O:{P:{Q:{R:{S:{T:{U:{V:{W:{X:{Y:{Z:{_:{$:{aa:{ba:{ca:{da:{ea:{fa:{ga:{ha:{ia:{ja:{ka:{la:{ma:{na:{oa:{pa:{qa:{ra:{sa:{ta:{ua:{va:{wa:{xa:{ya:{za:{Aa:{Ba:{Ca:{Da:{Ea:{Fa:{Ga:{Ha:{Ia:{Ja:{Ka:{La:{Ma:{Na:{Oa:{Pa:{Qa:{Ra:{Sa:{Ta:{Ua:{Va:{Wa:{switch(b|0){case 0:b=a-9>>>0<5?1073741825:0;a=(a|0)==133;b=a?1073741825:b;break y;case 1:Xa:{Ya:{Za:{_a:{$a:{ab:{bb:{cb:{db:{eb:{fb:{gb:{hb:{ib:{b=a&-256;if((b|0)<=2047){if(!b){break ib}if((b|0)==1536){break hb}if((b|0)!=1792){break Xa}c=0;d=1;if((a|0)!=1807){break Xa}break Q}if((b|0)<=69631){if((b|0)==2048){break gb}if((b|0)!=8192){break Xa}c=131076;switch(a-8204|0){case 1:break fb;case 0:break Q;default:break eb}}if((b|0)==69632){break db}if((b|0)!=917504){break Xa}c=8388608;switch(a-917505|0){case 62:break Za;case 58:break _a;case 57:break $a;case 45:break ab;case 43:break bb;case 32:break cb;case 0:break Q;default:break Ya}}c=16;if((a|0)!=173){break Xa}break Q}c=0;d=1;if(a-1536>>>0<6){break Q}d=(a|0)==1757;a=(a|0)==1564;b=a?2:0;break x}c=0;d=1;if((a|0)!=2274){break Xa}break Q}va=64;return 4}c=1073741826;if((a&-2)==8206){break Q}if(a-8234>>>0<5){va=0;return 2}c=128;if(a-8289>>>0<4){break Q}c=2;if(a-8294>>>0<4){break Q}c=8388608;if(a-8298>>>0>=6){break Xa}break Q}b=!(a-69821&-17);a=0;break w}va=536870976;break v}va=268435520;break v}va=-2147483584;break v}va=134217792;break v}va=67108928;break v}va=1073741888;break v}c=131072;d=64;if(a-917536>>>0<96){break Q}}break N;case 2:jb:{kb:{lb:{mb:{nb:{ob:{pb:{b=a&-256;if((b|0)<=130303){if((b|0)<=127743){if((b|0)<=64767){if((b|0)<=11007){if((b|0)==8192){break pb}if((b|0)!=9216){break jb}if(a-9255>>>0>=25){break ob}break M}if((b|0)==11008){break nb}if((b|0)!=11776){break jb}c=-2147483648;if(a-11845>>>0>=59){break jb}break Q}if((b|0)<=126975){if((b|0)==64768){break mb}if((b|0)!=65280){break jb}c=4194304;if(a-65520>>>0>=9){break jb}break Q}if((b|0)==126976|(b|0)==127232|(b|0)==127488){break P}break jb}if((b|0)<=129023){if((b|0)<=128255){if((b|0)==127744|(b|0)==128e3){break P}break jb}if((b|0)==128256|(b|0)==128512|(b|0)==128768){break P}break jb}if((b|0)<=129535){if((b|0)==129024|(b|0)==129280){break P}break jb}if((b|0)==129536|(b|0)==129792|(b|0)==130048){break P}break jb}if((b|0)<=919039){if((b|0)<=917759){if((b|0)<=130815){if((b|0)==130304){break P}if((b|0)!=130560){break jb}break P}if((b|0)==130816){break P}if((b|0)!=917504){break jb}if((a&-128)!=917632){break lb}break L}if((b|0)<=918271){if((b|0)==917760){break kb}c=4194304;if((b|0)!=918016){break jb}break Q}if((b|0)==918272|(b|0)==918528){break L}c=4194304;if((b|0)!=918784){break jb}break Q}if((b|0)<=920319){if((b|0)<=919551){if((b|0)==919040){break L}c=4194304;if((b|0)!=919296){break jb}break Q}if((b|0)==919552|(b|0)==919808){break L}c=4194304;if((b|0)!=920064){break jb}break Q}if((b|0)<=920831){if((b|0)==920320){break L}c=4194304;if((b|0)!=920576){break jb}break Q}if((b|0)==920832|(b|0)==921088){break L}c=4194304;if((b|0)!=921344){break jb}break Q}c=4194304;if((a|0)!=8293){break jb}break Q}c=-2147483648;if(a-9291>>>0>=21){break jb}break Q}if((a&-16)==11248|a-11219>>>0<25|((a|0)==11209|a-11194>>>0<3)){break M}b=a&-2;if((b|0)==11124){break M}c=-2147483648;if((b|0)!=11158){break jb}break Q}c=65536;if(a-64976>>>0>=32){break jb}break Q}if((a|0)==917504){break L}c=4194304;if(a-917506>>>0>=30){break jb}break Q}c=4194304;if(a>>>0>917999){break Q}}a=(a&65534)==65534;b=a>>>16|0;a=a<<16;break w;case 6:qb:{rb:{sb:{tb:{ub:{vb:{wb:{xb:{yb:{zb:{Ab:{Bb:{b=a&-256;if((b|0)<=7679){if((b|0)<=767){if(!b){break Bb}if((b|0)==256){break Ab}if((b|0)!=512){break N}if((a|0)!=585){break zb}break u}if((b|0)==768){break yb}if((b|0)==1024){break xb}if((b|0)!=7424){break N}c=16777216;if((a|0)!=7574){break N}break Q}if((b|0)<=119807){if((b|0)==7680){break wb}if((b|0)==8448){break vb}if((b|0)!=65280){break N}c=256;if(a-65345>>>0>=6){break N}break Q}if((b|0)<=120319){if((b|0)==119808){break ub}if((b|0)!=120064){break N}if(a>>>0>=120070){break tb}break K}if((b|0)==120320){break sb}if((b|0)!=120576){break N}if(a>>>0>=120597){break rb}break K}c=768;if(a-97>>>0<6){break Q}c=16777216;if(a-105>>>0>=2){break N}break Q}b=(a|0)==329;c=b>>>9|0;a=(a|0)==303;b=a?16777216:b<<23;break t}if((a|0)==616){break u}c=16777216;if((a|0)!=669){break N}break Q}c=128;Cb:{switch(a-976|0){case 35:break qb;case 0:case 1:case 2:case 5:case 32:case 33:break Q;default:break Cb}}if((a&-2)!=1012){break N}break Q}a=!(a-1110&-3);d=a>>>8|0;a=a<<24;break s}b=(a|0)==7883;d=b>>>8|0;a=(a|0)==7725;b=a?16777216:b<<24;break x}if(a-8458>>>0<10){break K}b=a-8495|0;if(b>>>0<11){break Va}break R}b=a&-2;if((b|0)==119842){break J}if(a-119808>>>0<85){break K}if(a-119894>>>0<2|a-119946>>>0<2){break J}if((a|0)==119995|a-119896>>>0<69|a-119982>>>0<12){break K}if((b|0)==119998){break J}if(a-119997>>>0<7){break K}c=16777344;if((b|0)==120050){break Q}c=128;if(a>>>0<=120004){break N}break Q}if((a&-2)==120102){break J}if(a-120094>>>0<28){break K}Db:{if((a|0)<=120257){if(a-120154>>>0<2){break J}c=16777344;if(a-120206>>>0>=2){break Db}break Q}if(a-120258>>>0<2){break J}c=16777344;if(a-120310>>>0<2){break Q}}c=128;if(a>>>0<=120145){break N}break Q}if(a-120362>>>0<2|a-120414>>>0<2){break J}c=16777344;if(a-120466>>>0<2){break Q}if(a-120540>>>0<31|a>>>0>120571|a>>>0<120486){break K}c=128;if(a-120514>>>0>=25){break N}break Q}if(a-120772>>>0<8|a-120746>>>0<25|(a-120714>>>0<31|a-120688>>>0<25)){break K}if((a|0)!=120597&a>>>0<120629|a-120656>>>0<31){break K}c=128;if(a-120630>>>0<25){break Q}break N}break u;case 7:Eb:{Fb:{Gb:{Hb:{Ib:{Jb:{Kb:{Lb:{Mb:{Nb:{Ob:{Pb:{Qb:{Rb:{Sb:{Tb:{Ub:{Vb:{Wb:{Xb:{Yb:{Zb:{b=a&-256;if((b|0)<=11263){if((b|0)<=3583){if((b|0)<=1535){if((b|0)==512){break Zb}if((b|0)==768){break Yb}if((b|0)!=1280){break N}c=4096;if((a|0)!=1369){break N}break Q}if((b|0)==1536){break Xb}if((b|0)==1792){break Wb}if((b|0)!=2304){break N}c=4096;if((a|0)!=2417){break N}break Q}if((b|0)<=7167){if((b|0)==3584){break Vb}if((b|0)==6144){break Ub}if((b|0)!=6656){break N}c=8192;if((a|0)!=6823){break N}break Q}if((b|0)==7168){break Tb}if((b|0)==7424){break Sb}if((b|0)!=8192){break N}c=16793600;b=a-8305|0;if(!b){break Q}if((b|0)==14){break Rb}break Qb}if((b|0)<=43263){if((b|0)<=40959){if((b|0)==11264){break Pb}if((b|0)==11776){break Ob}if((b|0)!=12288){break N}c=8192;switch(a-12293|0){case 1:case 2:case 3:case 4:case 5:case 6:case 7:case 8:case 9:case 10:case 11:case 12:case 13:case 14:case 15:case 16:case 17:case 18:case 19:case 20:case 21:case 22:case 23:case 24:case 25:case 26:case 27:case 28:case 29:case 30:case 31:case 32:case 33:case 34:case 35:case 36:case 37:case 38:case 39:case 40:case 41:case 42:case 43:break Mb;case 0:case 44:case 45:case 46:case 47:case 48:break Q;default:break Nb}}if((b|0)==40960){break Lb}if((b|0)==42496){break Kb}if((b|0)!=42752){break N}if(a-42775>>>0>=9){break Jb}break I}if((b|0)<=65279){if((b|0)==43264){break Ib}if((b|0)==43520){break Hb}if((b|0)!=43776){break N}c=20480;if((a&-4)!=43868){break N}break Q}if((b|0)==65280){break Gb}if((b|0)==92928){break Fb}if((b|0)!=93952){break N}c=4096;if(a-94099>>>0<13){break Q}c=8192;if((a&-2)!=94176){break N}break Q}c=16797696;if((a|0)==690){break Q}if(a-688>>>0<9){va=0;return 20480}if(a-697>>>0<7){break I}b=a&-2;if((b|0)==704){va=0;return 20480}c=4096;if(a-710>>>0<10){break Q}c=12288;if((b|0)==720){break Q}c=20480;if(a-736>>>0<5){break Q}a=(a&-3)==748;c=a>>>20|0;a=a<<12;break r}b=(a|0)==890?20480:0;a=(a|0)==884;b=a?4096:b;break y}c=8192;if((a|0)==1600){break Q}c=4096;if(a-1765>>>0>=2){break N}break Q}c=4096;if((a&-2)==2036){break Q}c=8192;if((a|0)!=2042){break N}break Q}a=!(a-3654&-129);b=a>>>19|0;a=a<<13;break w}c=8192;if((a|0)!=6211){break N}break Q}c=12288;if((a|0)==7291){break Q}c=4096;if(a-7288>>>0>=6){break N}break Q}c=16797696;if((a|0)==7522){break Q}c=20480;if(a-7468>>>0<63){break Q}c=16384;_b:{switch(a-7588|0){default:if((a|0)==7544){break Q}case 1:case 2:case 3:if(a-7579>>>0>=37){break N}break Q;case 0:case 4:break _b}}va=0;return 16793600}va=0;return 16384}c=16384;if(a-8336>>>0>=13){break N}break Q}c=(a|0)==11389;b=c>>>18|0;a=(a|0)==11388;c=a?16793600:c<<14;break q}c=-2147479552;if((a|0)!=11823){break N}break Q}if(a-12445>>>0<2){break Q}if((a|0)==12540){break Eb}}if(a-12541>>>0>=2){break N}break Q}c=8192;if((a|0)!=40981){break N}break Q}if((a|0)==42508){break p}if((a|0)==42623){break I}c=20480;if((a&-2)!=42652){break N}break Q}if((a|0)==42864){va=0;return 16384}if((a|0)==42888){break I}c=20480;if((a&-2)!=43e3){break N}break Q}b=(a|0)==43494;c=b>>>19|0;a=(a|0)==43471;b=a?8192:b<<13;break t}if((a|0)==43632){break p}if((a|0)==43741){break p}c=8192;if(a-43763>>>0>=2){break N}break Q}c=12288;if((a|0)==65392){break Q}c=135168;if((a&-2)!=65438){break N}break Q}c=8192;if((a&-2)==92994){break Q}break N}va=0;return 12288;case 8:c=128;$b:{ac:{bc:{cc:{dc:{ec:{fc:{gc:{hc:{b=a&-256;if((b|0)<=12543){if((b|0)<=5887){if((b|0)<=3583){if(!b){break hc}if((b|0)!=1536){break Z}b=8388608;if((a|0)!=1651){break Z}break W}if((b|0)==3584){break gc}if((b|0)!=4352){break Z}c=4194304;if(a-4447>>>0>=2){break Z}break X}if((b|0)<=8447){if((b|0)==5888){break fc}if((b|0)!=6400){break Z}b=a-6581|0;if(b>>>0>=6){break Z}b=(b<<3)+81432|0;c=K[b>>2];d=K[b+4>>2];break X}if((b|0)==8448){break ec}if((b|0)!=12288){break Z}b=2048;if((a|0)!=12294){break Z}break W}if((b|0)<=68863){if((b|0)<=63999){if((b|0)==12544){break dc}if((b|0)!=43520){break Z}b=a-43701|0;if(b>>>0<8){break ac}break Y}if((b|0)==64e3){break $b}if((b|0)!=65280){break Z}b=4194304;if((a|0)!=65440){break Z}break W}if((b|0)<=100095){if((b|0)==68864){break cc}if((b|0)!=70400){break Z}c=8192;if((a|0)!=70493){break Z}break U}if((b|0)==100096){break bc}if((b|0)!=126464){break Z}break X}b=!(a-170&-17);d=b>>>18|0;c=b<<14;break X}c=33554432;if(a-3648>>>0<5){break X}b=0;f=33554432;if((a|0)==3759){break W}if(a-3776>>>0>=5){break Z}break X}c=8388608;if(a-6051>>>0>=2){break Z}break X}if(a-8501>>>0>=4){break Z}break X}b=4194304;if((a|0)!=12644){break Z}break W}c=4096;if((a&-2)!=68898){break Z}break X}c=2048;if(a-100333>>>0<5){break X}break Z}c=33554432;if(!(211>>>b&1)){break Y}break X}b=a-64014|0;if(b>>>0>=28){break Z}b=(b<<3)+81480|0;c=K[b>>2];d=K[b+4>>2];break X;case 10:ic:{jc:{kc:{lc:{mc:{nc:{b=a&-256;if((b|0)<=119807){if((b|0)<=8447){if(!b){break nc}if((b|0)!=768){break N}c=128;switch(a-976|0){case 0:case 1:case 2:case 36:case 37:break Q;default:break N}}if((b|0)==8448){break mc}if((b|0)!=65280){break N}c=256;if(a-65313>>>0>=6){break N}break Q}if((b|0)<=120319){if((b|0)==119808){break lc}if((b|0)!=120064){break N}if(a>>>0>=120070){break kc}break K}if((b|0)==120320){break jc}if((b|0)!=120576){break N}if(a-120772>>>0>=8){break ic}break K}c=768;if(a-65>>>0>=6){break N}break Q}c=128;oc:{switch(a-8450|0){case 0:case 5:break Q;default:break oc}}if(a-8458>>>0<10){break K}b=a-8469|0;if(b>>>0<20){break Ua}if((a&-4)==8508){break Q}break _}if(a-119982>>>0<12|a>>>0>120004|(a-119977>>>0<4|a-119973>>>0<2)){break K}if((a|0)==119970|(a&-2)==119966|a-119808>>>0<85){break K}c=128;if(a-119894>>>0>=71){break N}break Q}if(a-120138>>>0<7|a>>>0>120145|((a|0)==120134|a-120128>>>0<5)){break K}if(a-120123>>>0<4|a-120094>>>0<28|((a|0)!=120070&a>>>0<120075|a-120086>>>0<7)){break K}c=128;if(a-120077>>>0>=8){break N}break Q}if(a-120540>>>0<31|a>>>0<120486){break K}c=128;if(a-120488>>>0>=25){break N}break Q}if(a-120714>>>0<31|a-120598>>>0<31){break K}c=128;if(a-120656>>>0<31){break Q}break N;case 11:pc:{qc:{rc:{sc:{tc:{uc:{vc:{wc:{xc:{yc:{zc:{Ac:{Bc:{Cc:{Dc:{Ec:{Fc:{b=a&-256;if((b|0)<=43263){if((b|0)<=3839){if((b|0)<=3071){if((b|0)==2304){break Fc}if((b|0)!=2816){break H}if((a|0)>3005){break Dc}if((a|0)!=2878){break Ec}va=0;return 132096}if((b|0)==3072){break Cc}if((b|0)!=3328){break H}c=132096;switch(a-3535|0){case 0:case 16:break Q;case 1:case 2:case 3:case 4:case 5:case 6:case 7:case 8:case 9:case 10:case 11:case 12:case 13:case 14:case 15:break H;default:break Bc}}if((b|0)<=6911){if((b|0)==3840){break Ac}if((b|0)!=4096){break H}c=1024;if(a-4139>>>0<2){break Q}switch(a-4145|0){case 0:case 7:case 10:case 11:case 37:case 38:case 49:case 54:case 55:case 82:case 83:break Q;case 86:case 87:case 88:case 89:case 90:case 91:case 94:case 105:case 106:break pc;default:break zc}}if((b|0)==6912){break yc}if((b|0)==7168){break xc}if((b|0)!=12288){break H}c=135168;if((a&-2)!=12334){break H}break Q}if((b|0)<=70399){if((b|0)<=43775){if((b|0)==43264){break wc}if((b|0)!=43520){break H}va=0;return a-43643&-3?1024:4096}if((b|0)==43776){break vc}if((b|0)==69888){break uc}if((b|0)!=70144){break H}c=4096;if((a|0)!=70197){break H}break Q}if((b|0)<=70911){if((b|0)==70400){break tc}if((b|0)!=70656){break H}b=(a|0)==70845?132096:1024;a=(a|0)==70832;b=a?132096:b;break y}if((b|0)==70912){break sc}if((b|0)==71168){break rc}if((b|0)!=119040){break H}c=131072;switch(a-119141|0){case 8:break I;case 1:break N;case 0:break Q;default:break qc}}b=(a|0)==2519?132096:1024;a=(a|0)==2494;b=a?132096:b;break y}c=132096;if((a|0)!=2903){break H}break Q}if((a|0)==3006){va=0;return 132096}c=132096;if((a|0)!=3031){break H}break Q}a=a-3266|0;if(a>>>0>20){break H}c=132096;if(!(1<<a&1572865)){break H}break Q}if((a|0)==3390){break Q}if((a|0)!=3415){break H}break Q}c=4096;if((a&-2)!=3902){break H}break Q}a=(a|0)==4252;c=a>>>22|0;a=a<<10;break r}c=1024;Gc:{switch(a-6965|0){default:if((a|0)==6916){break Q}break;case 0:case 6:break Q;case 1:case 2:case 3:case 4:case 5:break Gc}}if(a-6973>>>0<5){break Q}Hc:{switch(a-6979|0){case 1:break I;case 0:break Q;default:break Hc}}if((a|0)==7042|(a|0)==7073|(a&-2)==7078){break Q}if((a|0)==7082){break I}if((a|0)==7143|a-7146>>>0<3){break Q}a=(a|0)==7150;c=a>>>22|0;a=a<<10;break r}b=(a|0)==7415?4096:1024;a=(a|0)==7393;b=a?4096:b;break y}b=(a|0)==43456?4096:1024;a=(a|0)==43347;b=a?4096:b;break y}c=4096;if((a|0)!=44012){break H}break Q}c=4096;if((a|0)!=70080){break H}break Q}c=132096;Ic:{switch(a-70462|0){case 0:case 25:break Q;case 15:break Ic;default:break H}}break I}c=132096;if((a|0)!=71087){break H}break Q}c=4096;if((a|0)!=71350){break H}break Q}c=135168;if(a-119150>>>0<5){break Q}break H}break I;case 12:b=((a|0)==8419)<<6;a=0;break w;case 13:Jc:{Kc:{Lc:{Mc:{Nc:{Oc:{Pc:{Qc:{Rc:{Sc:{Tc:{Uc:{Vc:{Wc:{Xc:{Yc:{Zc:{_c:{$c:{ad:{bd:{cd:{dd:{ed:{fd:{gd:{hd:{id:{jd:{kd:{ld:{md:{nd:{od:{pd:{qd:{rd:{sd:{td:{ud:{vd:{wd:{xd:{yd:{zd:{Ad:{Bd:{Cd:{Dd:{Ed:{Fd:{b=a&-256;if((b|0)<=43775){if((b|0)<=5887){if((b|0)<=2559){if((b|0)<=1535){if((b|0)==768){break Fd}if((b|0)==1024){break Ed}if((b|0)!=1280){break N}if(a-1425>>>0>=17){break Dd}break I}if((b|0)<=2047){if((b|0)==1536){break Cd}if((b|0)!=1792){break N}c=1024;if((a|0)==1809){break Q}if((a&-16)!=1840){break Bd}va=0;return 5120}if((b|0)==2048){break Ad}if((b|0)!=2304){break N}if(a>>>0>=2307){break zd}break H}if((b|0)<=3583){if((b|0)<=3071){if((b|0)==2560){break yd}if((b|0)!=2816){break N}c=1024;switch(a-2876|0){case 0:break I;case 3:break Q;case 1:case 2:break wd;default:break xd}}if((b|0)==3072){break vd}if((b|0)!=3328){break N}b=a&-2;if((b|0)!=3328){break ud}break H}if((b|0)<=4095){if((b|0)==3584){break td}if((b|0)!=3840){break N}b=a&-2;if((b|0)!=3864){break sd}break I}if((b|0)==4096){break rd}if((b|0)!=4864){break N}c=1024;if((a|0)!=4959){break N}break Q}if((b|0)<=8191){if((b|0)<=6655){if((b|0)==5888){break qd}if((b|0)==6144){break pd}if((b|0)!=6400){break N}b=a-6432|0;if(b>>>0<=18){c=1024;if(1<<b&262535){break Q}}c=4096;if(a-6457>>>0>=3){break N}break Q}if((b|0)<=7167){if((b|0)==6656){break od}if((b|0)!=6912){break N}c=1024;if((a&-4)==6912){break Q}if((a|0)!=6964){break nd}break I}if((b|0)==7168){break md}if((b|0)!=7424){break N}c=4096;if(a-7620>>>0<12){break Q}c=1024;if(a-7655>>>0<14){break Q}a=a-7669|0;if(a>>>0>=11){break N}a=(a<<3)+82104|0;b=K[a>>2];break o}if((b|0)<=42495){if((b|0)<=11519){if((b|0)==8192){break ld}if((b|0)!=11264){break N}c=4096;if(a-11503>>>0>=3){break N}break Q}if((b|0)==11520){break kd}if((b|0)!=12288){break N}if(a-12330>>>0>=4){break jd}break I}if((b|0)<=43263){if((b|0)==42496){break id}if((b|0)!=43008){break N}if(a-43045>>>0>=2){break hd}break H}if((b|0)==43264){break gd}if((b|0)!=43520){break N}c=1024;switch(a-43561|0){case 83:case 150:case 152:break I;case 0:case 1:case 2:case 3:case 4:case 5:case 8:case 9:case 12:case 13:case 26:case 35:case 135:case 137:case 138:case 139:case 142:case 143:case 149:break Q;default:break fd}}if((b|0)<=71423){if((b|0)<=69375){if((b|0)<=66047){if((b|0)==43776){break ed}if((b|0)==64256){break dd}if((b|0)!=65024){break N}c=536870912;if(a-65024>>>0<15){break Q}d=64;if((a|0)==65039){break Q}c=4096;d=0;if((a&-16)!=65056){break N}break Q}if((b|0)<=68095){if((b|0)==66048){break cd}if((b|0)!=66304){break N}c=1024;if(a-66422>>>0>=5){break N}break Q}if((b|0)==68096){break bd}if((b|0)!=68864){break N}c=5120;if((a&-4)!=68900){break N}break Q}if((b|0)<=70399){if((b|0)<=69887){if((b|0)==69376){break ad}if((b|0)!=69632){break N}if(a-69688>>>0>=14){break $c}break H}if((b|0)==69888){break _c}if((b|0)!=70144){break N}c=1024;if(a-70191>>>0<3){break Q}switch(a-70196|0){case 2:break I;case 0:case 3:case 10:break Q;case 1:case 4:case 5:case 6:case 7:case 8:case 9:break Yc;default:break Zc}}if((b|0)<=70911){if((b|0)==70400){break Xc}if((b|0)!=70656){break N}if((a&-8)!=70712){break Wc}break H}if((b|0)==70912){break Vc}if((b|0)!=71168){break N}c=1024;if(a-71219>>>0<8){break Q}switch(a-71229|0){case 2:break I;case 0:case 3:break Q;case 1:break Tc;default:break Uc}}if((b|0)<=92927){if((b|0)<=72703){if((b|0)==71424){break Oa}if((b|0)==71680){break Sc}if((b|0)!=72192){break N}if(a-72193>>>0>=10){break Rc}break H}if((b|0)<=73215){if((b|0)==72704){break Qc}if((b|0)!=72960){break N}b=a-73009|0;if(b>>>0<19){break Ma}break $}if((b|0)==73216){break Pc}if((b|0)!=92672){break N}c=4096;if(a-92912>>>0>=5){break N}break Q}if((b|0)<=122879){if((b|0)<=113663){if((b|0)==92928){break Oc}if((b|0)!=93952){break N}c=4096;if(a-94095>>>0>=4){break N}break Q}if((b|0)==113664){break Nc}if((b|0)!=119040){break N}c=4096;switch(a-119143|0){case 0:case 1:case 2:case 20:case 21:case 22:case 23:case 24:case 25:case 26:case 27:case 30:case 31:case 32:case 33:case 34:case 35:case 36:case 67:case 68:case 69:case 70:break Q;default:break N}}if((b|0)<=125183){if((b|0)==122880){break Mc}if((b|0)!=124928){break N}c=4096;if(a-125136>>>0>=7){break N}break Q}if((b|0)==125184){break Lc}if((b|0)!=917760){break N}c=536870912;if(a-917760>>>0>=240){break N}break Q}if(a-768>>>0<69){break I}c=21504;if((a|0)==837){break Q}if(a-838>>>0<9){break I}c=4194304;if((a|0)==847){break Q}if((a&-8)==848){break I}c=4096;if(a-861>>>0>=6){break N}break Q}c=4096;if(a-1155>>>0>=5){break N}break Q}c=4096;if(a-1443>>>0<13){break Q}c=5120;if(a-1456>>>0<14){break Q}a=a-1471|0;if(a>>>0>=9){break N}a=(a<<3)+81944|0;b=K[a>>2];break o}if(a-1552>>>0<11){break H}c=5120;if(a-1611>>>0<8){break Q}if(a-1619>>>0<4){break H}Gd:{switch(a-1623|0){case 1:break I;case 0:break Q;case 2:case 3:case 4:case 5:case 6:case 7:case 8:case 25:case 127:case 128:case 129:case 130:case 131:case 132:case 133:break H;default:break Gd}}c=4096;if(a-1759>>>0<2){break Q}b=a-1761|0;if(b>>>0<8){break Ta}break aa}if(a-1856>>>0<11){break I}c=5120;if(a-1958>>>0<11){break Q}c=4096;if(a-2027>>>0>=9){break N}break Q}c=1024;Hd:{switch((a&-2)-2070|0){case 2:break I;case 0:break Q;default:break Hd}}if(a-2260>>>0<12|a-2089>>>0<4|(a-2075>>>0<9|a-2085>>>0<3)){break H}if(a-2275>>>0<7){va=0;return 5120}c=4096;if(a-2282>>>0<6){break Q}c=5120;if(a-2288>>>0<15){break Q}c=1024;if((a|0)!=2303){break N}break Q}c=1024;Id:{switch(a-2362|0){case 2:break I;case 0:break Q;default:break Id}}if(a-2369>>>0<8){break H}c=4096;Jd:{switch(a-2381|0){case 0:case 4:case 5:case 6:case 7:case 111:break Q;case 8:case 9:case 10:case 21:case 22:case 52:break H;default:break Jd}}if(a-2497>>>0<4){break H}if((a|0)==2509){break Q}c=1024;if((a&-2)!=2530){break N}break Q}if(a-2561>>>0<2){break H}c=4096;Kd:{switch(a-2620|0){case 0:case 17:case 128:case 145:break Q;case 5:case 6:case 11:case 12:case 15:case 16:case 21:case 52:case 53:case 57:case 69:case 70:case 133:case 134:case 135:case 136:case 137:case 139:case 140:case 166:case 167:case 190:case 191:case 192:break H;default:break Kd}}if(a-2813>>>0>=3){break N}break Q}if((a|0)!=2817){break wd}break H}if(a-2881>>>0<4){break H}c=4096;Ld:{switch(a-2893|0){case 0:break Q;case 9:break H;default:break Ld}}if((a&-2)==2914){break H}c=1024;Md:{switch(a-3008|0){default:if((a|0)!=2946){break N}break Q;case 1:case 2:case 3:case 4:case 5:case 6:case 7:case 8:case 9:case 10:case 11:case 12:break N;case 0:break Q;case 13:break Md}}break I}c=1024;Nd:{switch(a-3072|0){case 77:case 188:case 205:break I;case 0:case 62:case 63:case 64:case 70:case 71:case 72:case 74:case 75:case 76:case 85:case 86:case 98:case 99:case 129:case 191:case 198:case 204:break Q;default:break Nd}}if((a&-2)!=3298){break N}break Q}c=4096;if(a-3387>>>0<2){break Q}if(a-3393>>>0<4){break H}if((a|0)==3405){break Q}if((b|0)==3426){break H}switch(a-3530|0){case 0:break Q;case 8:case 9:case 10:case 12:break H;default:break N}}b=a-3633|0;if(b>>>0<10){break Sa}break ba}c=a-3893|0;if(c>>>0>4|!(1<<c&21)){break ca}break I}c=1024;Od:{switch(a-4141|0){case 10:case 12:case 13:break I;case 0:case 1:case 2:case 3:case 5:case 6:case 7:case 8:case 9:case 16:case 17:case 43:case 44:case 49:case 50:case 51:case 68:case 69:case 70:case 71:case 85:case 88:case 89:break Q;default:break Od}}c=(a|0)==4253;b=c>>>22|0;a=(a|0)==4237;c=a?4096:c<<10;break q}c=1024;Pd:{Qd:{switch(a-5906|0){case 0:case 1:case 32:case 33:break Q;case 2:case 3:case 4:case 5:case 6:case 7:case 8:case 9:case 10:case 11:case 12:case 13:case 14:case 15:case 16:case 17:case 18:case 19:case 20:case 21:case 22:case 23:case 24:case 25:case 26:case 27:case 28:case 29:case 30:case 31:break Pd;default:break Qd}}switch(a-5970|0){case 0:case 1:case 32:case 33:break Q;default:break Pd}}c=4194304;if((a&-2)==6068){break Q}b=a-6071|0;if(b>>>0<16){break Ra}break da}c=536870912;if(a-6155>>>0<3){break Q}c=67109888;if(a-6277>>>0<2){break Q}c=1024;if((a|0)!=6313){break N}break Q}if(a-6679>>>0<2){break H}c=1024;Rd:{switch(a-6683|0){case 0:case 59:case 61:case 62:case 63:case 64:case 65:case 66:case 67:case 71:case 74:case 75:case 76:case 77:case 78:case 79:case 80:case 81:case 88:case 89:break Q;default:break Rd}}c=4096;if(a-6832>>>0<14){break Q}a=a-6773|0;if(a>>>0>=11){break N}a=(a<<3)+82016|0;b=K[a>>2];break o}if(a-6966>>>0<5){break Q}Sd:{switch(a-6972|0){case 0:case 6:break Q;default:break Sd}}if(a-7019>>>0<9){break I}switch(a-7040|0){case 43:break I;case 0:case 1:case 34:case 35:case 36:case 37:case 40:case 41:case 44:case 45:case 104:case 105:case 109:case 111:case 112:case 113:break Q;default:break N}}c=1024;if(a-7212>>>0<8){break Q}c=12288;Td:{switch(a-7222|0){case 1:break I;case 0:break Q;default:break Td}}if(a-7380>>>0<13){break I}c=4096;Ud:{switch(a-7376|0){case 0:case 1:case 2:case 18:case 19:case 20:case 21:case 22:case 23:case 24:case 29:case 36:break Q;default:break Ud}}if((a&-2)!=7416){break N}break Q}c=128;if(a-8400>>>0<13){break Q}a=a-8417|0;if(a>>>0>=15){break N}a=(a<<3)+82192|0;b=K[a>>2];break o}c=1024;if((a&-32)!=11744){break N}break Q}c=4096;if(a-12441>>>0>=2){break N}break Q}if((a|0)==42607){break I}if(a-42612>>>0<8){break H}a=a&-2;if((a|0)==42620){break I}if((a|0)==42654){break Jc}c=4096;if((a|0)!=42736){break N}break Q}c=4096;Vd:{switch(a-43204|0){case 0:break Q;case 1:break H;default:break Vd}}if(a-43232>>>0>=18){break N}break Q}if(a-43302>>>0<5){break H}if(a-43307>>>0<3){break I}if(a-43335>>>0<11|a-43392>>>0<3){break H}c=4096;if((a|0)==43443){break Q}c=1024;if(a-43446>>>0<4){break Q}b=(a|0)==43493;d=b>>>20|0;a=(a|0)==43452;b=a?1024:b<<12;break x}if((a&-2)==43756){break Q}c=4096;if((a|0)!=43766){break N}break Q}c=1024;Wd:{switch(a-44005|0){case 0:case 3:break Q;case 8:break Wd;default:break N}}break I}c=5120;if((a|0)!=64286){break N}break Q}c=4096;if((a|0)!=66272){break N}break Q}if((a&-4)==68108){break H}b=a-68097|0;if(b>>>0<6){break Qa}break ea}c=4096;if(a-69446>>>0>=11){break N}break Q}if(a-69811>>>0<4){break H}c=1024;if((a|0)==69633){break Q}c=4096;if(a-69817>>>0>=2){break N}break Q}c=1024;Xd:{switch(a-69888|0){case 51:case 52:case 115:break I;case 0:case 1:case 2:case 39:case 40:case 41:case 42:case 43:case 45:case 46:case 47:case 48:case 49:case 50:break Q;default:break Xd}}if((a&-2)==70016|a-70070>>>0<9){break Q}c=4096;if(a-70090>>>0>=3){break N}break Q}if((a|0)==70367){break Q}}if(a-70371>>>0<6){break Q}c=4096;if(a-70377>>>0>=2){break N}break Q}if((a&-2)==70400){break H}c=4096;Yd:{switch(a-70460|0){case 0:case 42:case 43:case 44:case 45:case 46:case 47:case 48:case 52:case 53:case 54:case 55:case 56:break Q;case 4:break Yd;default:break N}}break H}if((a|0)==70722){break I}if(a-70723>>>0<2){break H}b=a-70835|0;if(b>>>0<=13){break Kc}break fa}b=a-71090|0;if(b>>>0<12){break Pa}break ga}switch(a-71339|0){case 0:case 2:break Q;default:break Tc}}if(a-71344>>>0<6){break Q}c=4096;if((a|0)!=71351){break N}break Q}c=1024;if(a-71727>>>0<10){break Q}c=4096;if(a-71737>>>0>=2){break N}break Q}if((a|0)==72244){break I}if(a-72245>>>0<10){break H}c=4096;if((a|0)==72263){break Q}if(a-72273>>>0<11){break H}c=1024;if(a-72330>>>0<13){break Q}b=(a|0)==72345;c=b>>>20|0;a=(a|0)==72344;b=a?8192:b<<12;break t}b=a-72752|0;if(b>>>0<16){break Na}break ha}c=1024;if(a-73459>>>0>=2){break N}break Q}c=1024;if(a-92976>>>0>=7){break N}break Q}c=1024;if((a|0)!=113822){break N}break Q}c=1024;if(a-122888>>>0<17){break Q}a=a-122880|0;if(a>>>0>=43){break N}a=(a<<3)+82816|0;b=K[a>>2];break o}c=12288;if(a-125252>>>0<3){break Q}c=1024;if((a|0)==125255){break Q}c=4096;if(a-125256>>>0<3){break Q}break N}if(!(1<<b&12479)){break fa}break H}break H;case 14:b=a&-256;Zd:{if((b|0)!=120576){if((b|0)!=65280){if(b){break Zd}c=768;d=66;if(a-48>>>0>=10){break Zd}break Q}c=256;if(a-65296>>>0>=10){break Zd}break Q}c=128;if(a-120782>>>0<50){break Q}}break N;case 15:b=a&-256;_d:{if((b|0)!=12288){if((b|0)!=8448){break _d}c=a&-16;a=(c|0)==8560;b=a>>>18|0;d=a<<14;a=(c|0)==8544;c=a?32768:d;break q}if(a-12321>>>0<9){va=0;return 2048}if(a-12344>>>0<3){va=0;return 2048}c=2048;if((a|0)==12295){break Q}}break N;case 16:$d:{ae:{be:{b=a&-256;if((b|0)<=9215){if((b|0)==4864){break be}if((b|0)!=6400){break $d}c=134217728;if((a|0)!=6618){break $d}break Q}if((b|0)==9216){break ae}if((b|0)!=127232){break $d}c=0;d=-2147483648;if((a|0)==127232){break Q}d=268435456;if(a-127233>>>0>=10){break $d}break Q}c=134217728;if(a-4969>>>0>=9){break $d}break Q}c=0;d=-2147483648;if(a-9352>>>0<20){break Q}}break N;case 17:a=(a|0)==8256;d=a>>>25|0;a=a<<7;break s;case 18:ce:{de:{ee:{fe:{b=a&-256;if((b|0)<=11775){if((b|0)<=6143){c=-2147483624;if(!b){break Q}if((b|0)!=1280){break ce}c=24;if((a|0)!=1418){break ce}break Q}if((b|0)==6144){break fe}if((b|0)!=8192){break ce}c=-2147483624;if((a&-2)==8208){break Q}a=a-8211>>>0<2;b=-2147483640;break n}if((b|0)<=65023){if((b|0)==11776){break ee}if((b|0)!=12288){break ce}b=(a|0)==12336;a=(a|0)==12316;c=a?-2147483640:b?-2147483640:8;va=a?0:b?130:0;break m}if((b|0)==65024){break de}if((b|0)!=65280){break ce}c=24;if((a|0)!=65293){break ce}break Q}c=24;if((a|0)!=6150){break ce}break Q}c=-2147483624;if((a|0)==11799){break Q}a=(a&-2)==11834;b=-2147483640;break n}c=8;d=8388608;if(a-65073>>>0<2){break Q}c=152;d=0;if((a|0)==65123){break Q}}va=0;return 8;case 19:ge:{he:{ie:{je:{ke:{le:{b=a&-256;if((b|0)<=11775){if((b|0)<=8959){if(b){break le}break M}if((b|0)==8960){break ke}if((b|0)==9984){break je}if((b|0)!=10496){break N}break G}if((b|0)<=64767){c=-2147483648;if((b|0)==11776){break Q}if((b|0)!=12288){break N}c=-2147483616;switch(a-12301|0){case 0:case 2:break Q;default:break ie}}if((b|0)==64768){break he}if((b|0)==65024){break ge}if((b|0)!=65280){break N}c=32;if((a|0)==65379){break Q}break N}if((b|0)!=8192){break N}me:{switch(a-8318|0){default:c=-2147483648;if((a|0)!=8262){break N}break Q;case 1:case 2:case 3:case 4:case 5:case 6:case 7:case 8:case 9:case 10:case 11:case 12:case 13:case 14:case 15:break N;case 0:case 16:break me}}break K}c=-2147483520;ne:{switch(a-8969|0){case 1:break N;case 0:case 2:break Q;default:break ne}}if((a|0)!=9002){break N}va=0;return-2139095040}c=-2147483520;if((a|0)==10182){break Q}break F}va=0;return(a&-2)==12318?-2147483616:-2147483648}c=-2147483648;if((a|0)!=64830){break N}break Q}a=!(a-65090&-3);d=a>>>27|0;a=a<<5;break s;case 20:a=a&-256;if(!a){break l}c=-2147483616;if((a|0)==8192){break Q}break O;case 21:a=a&-256;if(!a){break l}c=-2147483616;if((a|0)==8192){break Q}break O;case 22:oe:{pe:{qe:{re:{se:{te:{ue:{ve:{we:{xe:{ye:{ze:{Ae:{Be:{Ce:{De:{Ee:{Fe:{Ge:{He:{Ie:{Je:{Ke:{Le:{Me:{Ne:{Oe:{Pe:{Qe:{Re:{Se:{Te:{Ue:{Ve:{We:{Xe:{Ye:{Ze:{_e:{$e:{af:{bf:{cf:{df:{ef:{ff:{gf:{hf:{b=a&-256;if((b|0)<=43519){if((b|0)<=5887){if((b|0)<=2303){if((b|0)<=1535){if(!b){break hf}if((b|0)==768){break gf}if((b|0)!=1280){break N}c=0;d=538968064;if(a-1371>>>0<2){break Q}d=268435456;switch(a-1373|0){case 0:break Q;case 1:break ef;default:break ff}}if((b|0)==1536){break cf}if((b|0)==1792){break bf}if((b|0)!=2048){break N}b=a-2103|0;if(b>>>0<8){break Ka}break ia}if((b|0)<=3839){if((b|0)==2304){break af}if((b|0)==3328){break $e}if((b|0)!=3584){break N}c=64;if((a&-2)!=3674){break N}break Q}if((b|0)<=4863){if((b|0)==3840){break _e}if((b|0)!=4096){break N}c=268435520;if((a&-2)==4170){break Q}c=0;d=16777216;if((a|0)!=4347){break N}break Q}if((b|0)==4864){break Ze}if((b|0)!=5632){break N}c=64;switch(a-5741|0){case 1:break e;case 0:break Q;default:break Ye}}if((b|0)<=11263){if((b|0)<=6655){if((b|0)==5888){break Xe}if((b|0)==6144){break Ia}if((b|0)!=6400){break N}b=(a|0)==6469;a=(a|0)==6468;c=a?268435520:b?268435520:0;va=a?536870912:b?1073741824:0;break m}if((b|0)<=7167){if((b|0)==6656){break We}if((b|0)!=6912){break N}b=a&-2;if((b|0)!=7002){break Ve}break E}if((b|0)==7168){break Ue}if((b|0)!=8192){break N}c=-2147483520;switch(a-8214|0){case 1:break M;case 0:break Q;case 16:break Te;default:break Se}}if((b|0)<=41983){if((b|0)==11264){break Re}if((b|0)==11776){break Qe}if((b|0)!=12288){break N}c=-2147483584;d=272629760;switch(a-12289|0){case 2:break M;case 0:break Q;case 1:break Oe;default:break Pe}}if((b|0)<=43007){if((b|0)==41984){break Ne}if((b|0)!=42496){break N}c=64;d=268435456;switch(a-42739|0){case 4:break f;case 0:break e;case 3:break c;case 2:break Q;case 1:break Le;default:break Me}}if((b|0)==43008){break Ke}if((b|0)!=43264){break N}c=4096;switch(a-43310|0){case 0:break Q;case 1:break E;default:break Je}}if((b|0)<=70655){if((b|0)<=67839){if((b|0)<=65279){if((b|0)==43520){break Ie}if((b|0)==43776){break He}if((b|0)!=65024){break N}c=0;d=268435456;f=a&-2;if((f|0)==65040){break Q}b=a-65042|0;if(b>>>0<8){break Ga}break ja}if((b|0)==65280){break Ge}if((b|0)==66304){break Fe}if((b|0)!=67584){break N}c=64;if((a|0)!=67671){break N}break Q}if((b|0)<=69375){if((b|0)==67840){break Ee}if((b|0)==68096){break De}if((b|0)!=68352){break N}c=64;switch(a-68410|0){case 0:case 1:case 2:case 3:case 4:case 5:case 95:case 96:case 97:case 98:break Q;default:break N}}if((b|0)<=69887){if((b|0)==69376){break Ce}if((b|0)!=69632){break N}if(a-69703>>>0>=2){break Be}break E}if((b|0)==69888){break Ae}if((b|0)!=70144){break N}b=a-70200|0;if(b>>>0<=4){break ze}if((a|0)!=70313){break N}break E}if((b|0)<=74751){if((b|0)<=71423){if((b|0)==70656){break ye}if((b|0)==70912){break xe}if((b|0)!=71168){break N}c=268435520;if(a-71233>>>0>=2){break N}break Q}if((b|0)<=72703){if((b|0)==71424){break we}if((b|0)!=72192){break N}if(a-72258>>>0>=2){break ve}break E}if((b|0)==72704){break ue}if((b|0)!=73216){break N}c=268435520;if(a-73463>>>0>=2){break N}break Q}if((b|0)<=93695){if((b|0)==74752){break te}if((b|0)==92672){break re}if((b|0)!=92928){break N}c=268435520;if(a-92983>>>0<2){break Q}b=(a|0)==92996?268435520:0;a=(a|0)==92985;b=a?64:b;break y}if((b|0)<=121343){if((b|0)==93696){break se}if((b|0)!=113664){break N}c=268435520;d=-2147483648;if((a|0)!=113823){break N}break Q}if((b|0)==121344){break Fa}if((b|0)!=125184){break N}c=((a|0)==125279)<<30;a=(a|0)==125278;b=a&0;va=a?536870912:c;break j}c=-1879048128;d=536870912;jf:{kf:{lf:{mf:{nf:{switch(a-33|0){default:switch(a-183|0){case 1:case 2:case 3:case 4:case 5:case 6:case 7:break jf;case 8:break lf;case 0:break mf;default:break kf};case 2:va=66;break h;case 9:va=66;break h;case 11:va=268435456;return-2147483584;case 13:va=-2147483648;return-1879048128;case 25:va=134217728;return-2147483584;case 26:va=67108864;return-2147483584;case 1:case 6:break l;case 0:break Q;case 3:case 4:case 5:case 7:case 8:case 10:case 12:case 14:case 15:case 16:case 17:case 18:case 19:case 20:case 21:case 22:case 23:case 24:case 27:case 28:case 29:break jf;case 30:break nf}}va=1073741824;return-1879048128}va=0;return 134230016}va=1078984704;break h}if((a|0)==161){break ka}}break M}b=(a|0)==903;a=(a|0)==894;c=a?64:b?134217792:0;va=a?1073741824:b?67108864:0;break m}if((a|0)==1417){break df}if((a|0)!=1475){break N}break D}va=1075838976;break g}va=-2143289344;break d}c=64;d=268435456;of:{switch(a-1548|0){case 15:break c;case 1:case 2:case 3:case 4:case 5:case 6:case 7:case 8:case 9:case 10:case 11:case 12:case 13:case 14:case 16:case 17:break N;case 0:break Q;case 19:break of;case 18:break E;default:break qe}}break f}b=a-1792|0;if(b>>>0<6){break La}c=64;d=134217728;if((a&-2)==1798){break Q}d=67108864;pf:{qf:{rf:{switch(a-1800|0){default:switch(a-2040|0){case 1:break pf;case 0:break qf;default:break N};case 3:break N;case 0:break Q;case 1:break rf;case 2:case 4:break D}}va=1073741824;break b}va=268435456;break b}va=536870912;break d}b=(a|0)==2405;a=(a|0)==2404;c=a?268435520:b?268435520:0;va=a?-2143289344:b?16777216:0;break m}c=0;d=-2143289344;if((a|0)!=3572){break N}break Q}c=64;sf:{switch(a-3848|0){case 5:va=-2143289344;break b;case 6:va=16777216;break b;case 0:break Q;default:break sf}}if(a-3854>>>0<5){break Q}c=0;d=268435456;if((a|0)!=3860){break N}break Q}b=a-4961|0;if(b>>>0<4){break Ja}c=64;d=134217728;if(a-4965>>>0<2){break Q}b=(a|0)==4968;a=(a|0)==4967;c=a?268435520:b?268435520:0;va=a?1073741824:b?16777216:0;break m}if(a-5867>>>0>=3){break N}break Q}c=268435520;if(a-5941>>>0<2){break Q}a=a-6100|0;if(a>>>0>=7){break N}a=(a<<3)+83240|0;b=K[a>>2];break o}c=268435520;if((a&-4)!=6824){break N}break Q}c=64;if((a|0)==7005){break Q}c=268435520;if((b|0)!=7006){break N}break Q}if(a-7227>>>0<2){break E}c=64;if(a-7229>>>0<3){break Q}c=268435520;if((a&-2)==7294){break Q}c=4096;if((a|0)!=7379){break N}break Q}va=33554432;break h}if((a&-8)==8224){break M}if(a-8242>>>0<3){break Q}if(a-8240>>>0<9){break M}b=a-8251|0;if(b>>>0<21){break Ha}break la}if((a|0)==11513){va=-2147483648;break g}c=0;d=1073741824;if((a&-2)==11514){break Q}d=-2147483648;if((a|0)!=11518){break N}break Q}c=-1879048128;tf:{switch(a-11822|0){case 4:va=268435456;break h;case 5:va=-2147483648;break h;case 6:va=268435456;break h;case 7:va=67108864;break h;case 14:va=-2147483648;return-1879048128;case 19:va=268435456;return-2147483584;case 30:case 32:va=0;return-2147483584;case 0:break Q;default:break tf}}break M}if((a|0)==12349){break C}if((a|0)!=12539){break N}va=0;return 16}va=-2143289344;return-1879048128}b=(a|0)==42239;a=(a|0)==42238;c=a?64:b?268435520:0;va=a?268435456:b?-2147483648:0;break m}uf:{switch(a-42509|0){case 1:break e;case 0:break Q;case 2:break uf;default:break N}}break f}va=134217728;break b}if(a-43126>>>0<2){break E}c=268435520;if(a-43214>>>0>=2){break N}break Q}if((a|0)==43463){break D}c=268435520;if((a&-2)!=43464){break N}break Q}if(a-43613>>>0<3){break E}c=64;if((a|0)==43743){break Q}c=268435520;if((a&-2)!=43760){break N}break Q}c=268435520;if((a|0)!=44011){break N}break Q}c=268435520;d=541065216;vf:{switch(a-65281|0){case 1:case 6:va=0;return 32;case 11:va=272629760;break b;case 13:va=-2143289344;break d;case 100:va=0;return 16;case 25:va=138412032;break b;case 26:va=71303168;break b;case 30:va=1077936128;break d;case 96:break e;case 59:break K;case 0:break Q;case 99:break vf;default:break N}}va=268435456;break b}b=(a|0)==66512;c=b>>>26|0;a=(a|0)==66463;b=a?64:b<<6;break t}c=64;if((a|0)!=67871){break N}break Q}c=268435520;if((a&-2)==68182){break Q}c=64;if(a-68336>>>0>=6){break N}break Q}c=268435520;if(a-69461>>>0>=5){break N}break Q}c=64;if(a-69705>>>0<5){break Q}c=268435520;if(a-69822>>>0>=4){break N}break Q}if(a-69953>>>0<2){break E}b=a-70085|0;if(b>>>0<=26){break pe}break ma}if((b|0)!=2){break E}break D}c=268435520;if(a-70731>>>0<2){break Q}b=(a|0)==70747;d=b>>>26|0;a=(a|0)==70733;b=a?64:b<<6;va=a?268435456:d;break j}c=268435520;wf:{switch((a&-2)-71106|0){case 0:break Q;case 2:break oe;default:break wf}}c=8192;if(a-71110>>>0<3){break Q}c=268435520;if(a-71113>>>0>=15){break N}break Q}c=268435520;if(a-71484>>>0>=3){break N}break Q}c=268435520;if(a-72347>>>0<2){break Q}c=64;if(a-72353>>>0>=2){break N}break Q}c=268435520;if(a-72769>>>0<2){break Q}b=(a|0)==72817;c=b>>>26|0;a=(a|0)==72771;b=a?64:b<<6;break t}c=64;d=134217728;if(a-74865>>>0<2){break Q}d=0;if(a-74864>>>0>=5){break N}break Q}b=(a|0)==93848?268435520:0;a=(a|0)==93847;b=a?64:b;break y}c=268435520;if((a&-2)==92782){break Q}d=-2147483648;if((a|0)!=92917){break N}break Q}if((a|0)==1748){break e}break N}if(!(1<<b&100663555)){break ma}break E}break D;case 23:xf:{yf:{zf:{Af:{Bf:{Cf:{b=a&-256;if((b|0)<=11775){if((b|0)<=8959){if(b){break Cf}break M}if((b|0)==8960){break Bf}if((b|0)==9984){break Af}if((b|0)!=10496){break N}break G}if((b|0)<=64767){if((b|0)==11776){break zf}if((b|0)!=12288){break N}a=a-12300|0;if(a>>>0<=17){c=-2147483616;if(1<<a&131077){break Q}}break M}if((b|0)==64768){break yf}if((b|0)==65024){break xf}if((b|0)!=65280){break N}c=32;if((a|0)==65378){break Q}break N}if((b|0)!=8192){break N}c=-2147483616;Df:{switch(a-8218|0){case 1:case 2:case 3:break N;case 0:case 4:break Q;default:break Df}}Ef:{switch(a-8317|0){default:if((a|0)!=8261){break N}break M;case 1:case 2:case 3:case 4:case 5:case 6:case 7:case 8:case 9:case 10:case 11:case 12:case 13:case 14:case 15:break N;case 0:case 16:break Ef}}break K}c=-2147483520;Ff:{switch(a-8968|0){case 1:break N;case 0:case 2:break Q;default:break Ff}}if((a|0)!=9001){break N}va=0;return-2139095040}c=-2147483520;if((a|0)==10181){break Q}break F}va=0;return(a|0)==11842?-2147483616:-2147483648}c=-2147483648;if((a|0)!=64831){break N}break Q}a=!(a-65089&-3);c=a>>>27|0;a=a<<5;break r;case 24:a=a>>>0<256;c=a>>>1|0;a=a<<31;break r;case 25:Gf:{Hf:{If:{Jf:{Kf:{Lf:{Mf:{Nf:{b=a&-256;if((b|0)<=12287){if((b|0)<=767){if(!b){break Nf}if((b|0)!=512){break Gf}if(a-751>>>0>=17){break Mf}break I}if((b|0)==768){break Lf}if((b|0)!=7936){break Gf}c=4096;switch(a-8125|0){case 0:case 2:case 3:case 4:case 16:case 17:case 18:case 32:case 33:case 34:case 48:case 49:case 50:case 64:case 65:break Q;default:break Gf}}if((b|0)<=43775){if((b|0)==12288){break Kf}if((b|0)!=42752){break Gf}c=4096;if((a&-2)!=42784){break Gf}break Q}if((b|0)==43776){break Jf}if((b|0)==65280){break If}c=0;d=78;if((b|0)!=127744){break Gf}break Q}Of:{switch(a-168|0){default:c=-2147479424;Pf:{switch(a-94|0){case 0:break Q;case 2:break Pf;default:break Gf}}va=0;return-2147479552;case 0:case 7:break I;case 1:case 2:case 3:case 4:case 5:case 6:case 8:case 9:case 10:case 11:case 13:case 14:case 15:break Gf;case 12:case 16:break Of}}break I}if((a|0)==749|a-741>>>0<7){break I}if(a-706>>>0>=4){break Hf}break I}a=a-885|0;if(a>>>0>16){break Gf}c=4096;if(!(1<<a&98305)){break Gf}break Q}c=67112960;if(a-12443>>>0>=2){break Gf}break Q}c=4096;if((a|0)!=43867){break Gf}break Q}c=4224;Qf:{switch(a-65342|0){default:if((a|0)!=65507){break Gf}break;case 0:break Q;case 1:break Gf;case 2:break Qf}}break I}c=4096;if(a-722>>>0<14){break Q}}break N;case 26:Rf:{Sf:{Tf:{Uf:{Vf:{Wf:{b=a&-256;if((b|0)<=9471){if((b|0)<=8447){if(b){break Rf}break M}if((b|0)==8448){break Wf}if((b|0)==8704){break Vf}c=-2147483648;if((b|0)!=8960){break N}break Q}if((b|0)<=10495){if((b|0)==9472){break Uf}if((b|0)==9728){break Tf}if((b|0)==9984){break M}break N}if((b|0)==10496){break Sf}if((b|0)==10752){break M}c=-2147483648;if((b|0)!=11008){break N}break Q}if((a|0)==8472){va=0;return 67108864}if((a|0)==8596){break B}c=-2147483648;if(a>>>0<=8591){break N}break Q}c=-2147483640;if((a|0)==8722){break Q}a=a-8942>>>0<4;b=-2147483648;va=a?33554432:0;break j}c=-2147483648;d=130;if(a-9723>>>0<2){break Q}a=a-9725>>>0<2;b=-2147483648;va=a?134:0;break j}c=-2147483648;d=128;if((a|0)==9839){break Q}break M}c=-2147483648;d=130;if((a&-2)==10548){break Q}a=(a|0)==10626;b=-2147483648;va=a?134217728:0;break j}if((b|0)==8192){break na}break N;case 27:Xf:{Yf:{Zf:{_f:{$f:{ag:{bg:{cg:{dg:{eg:{fg:{gg:{hg:{ig:{jg:{kg:{lg:{mg:{ng:{og:{pg:{qg:{rg:{sg:{b=a&-256;if((b|0)<=12287){if((b|0)<=9727){if((b|0)<=8959){if(!b){break sg}if((b|0)!=8448){break N}c=0;d=130;switch(a-8482|0){case 7:break K;case 0:break Q;case 1:case 2:case 3:case 4:case 5:case 6:case 8:case 9:case 10:case 11:break og;case 12:break qg;default:break rg}}if((b|0)==8960){break ng}if((b|0)==9216){break mg}if((b|0)!=9472){break N}c=-2147483520;switch((a&-2)-9632|0){case 0:break Q;case 10:break B;default:break lg}}if((b|0)<=11007){if((b|0)==9728){break kg}if((b|0)==9984){break jg}c=-2147483648;if((b|0)!=10240){break N}break Q}if((b|0)==11008){break ig}if((b|0)==11776){break hg}if((b|0)!=12032){break N}c=1048576;if(a>>>0<12246){break Q}c=262144;switch((a&-2)-12272|0){case 0:break Q;case 2:break Xf;default:break gg}}if((b|0)<=127999){if((b|0)<=127231){if((b|0)==12288){break fg}if((b|0)==12800){break eg}if((b|0)!=126976){break N}b=(a|0)==127183;a=(a|0)==126980;c=a?0:b&0;va=a?134:b?134:128;break m}if((b|0)==127232){break dg}if((b|0)==127488){break cg}if((b|0)!=127744){break N}if(a>>>0>=127777){break bg}break A}if((b|0)<=128767){if((b|0)==128e3){break ag}if((b|0)==128256){break $f}if((b|0)!=128512){break N}b=a-128581|0;if(b>>>0<11){break va}break oa}if((b|0)==128768){break _f}if((b|0)==129280){break Zf}if((b|0)!=129536){break N}va=128;break g}b=(a|0)==174;a=(a|0)==169;c=a?-2147483648:-2147483648;va=a?130:b?130:0;break m}switch(a-8616|0){case 0:break M;case 1:case 2:break pg;default:break og}}va=0;return 67108864}va=130;return-2147483520}c=-2147483520;if(a-8597>>>0<5){break Q}if(a-8604>>>0<18){break G}b=a-8624|0;if(b>>>0<8){break Ea}break pa}if(a>>>0<8968){break M}b=a&-2;if((b|0)==8986){break i}if(a-8972>>>0<20|a-8994>>>0<6){break M}if((a|0)==9e3){break B}if(a-9003>>>0<81){break M}c=-2147483648;d=128;if((a|0)==9096){break Q}if(a-9085>>>0<30){break M}c=-2147483520;d=0;if((b|0)==9140){break Q}tg:{switch(a-9143|0){case 0:case 25:break Q;case 24:break B;default:break tg}}if(a-9140>>>0<40){break M}if((a|0)==9186){break Q}b=a-9193|0;if(b>>>0<4){break i}c=-2147483648;d=134;ug:{switch(a-9200|0){case 0:case 3:break Q;default:break ug}}if(b>>>0<11){break B}d=130;if(a-9208>>>0<3){break Q}d=0;if(a>>>0<=9186){break N}break Q}c=-2147483648;if(a-9216>>>0<75){break Q}c=33792;d=130;if((a|0)==9410){break Q}d=0;if(a-9398>>>0<26){break Q}c=17408;if(a-9424>>>0>=26){break N}break Q}if(a-9646>>>0<8){break G}d=130;if((a|0)==9654){break Q}if((a&-4)==9660){break G}vg:{switch(a-9664|0){case 0:break Q;case 6:case 7:case 10:case 11:case 15:case 16:case 17:case 18:case 19:case 34:case 36:break G;default:break vg}}va=0;return a-9703>>>0<6?-2147483520:-2147483648}wg:{switch((a&-16)-9728>>>4|0){case 0:if(a>>>0<9733){break B}c=-2147483520;d=128;xg:{switch(a-9733|0){case 0:break Q;case 9:break xg;case 1:break G;default:break qa}}break B;case 2:b=a-9760|0;if(b>>>0<11){break Ca}c=-2147483648;d=130;if(a>>>0<=9773){break qa}break Q;case 3:c=-2147483648;d=130;if(a-9784>>>0>=3){break qa}break Q;case 4:c=-2147483520;d=130;yg:{switch(a-9792|0){case 0:case 2:break Q;default:break yg}}c=-2147483648;d=134;if(a>>>0<=9799){break qa}break Q;case 5:c=-2147483648;d=134;if(a>>>0<9812){break Q}d=130;if((a|0)!=9823){break qa}break Q;case 6:if((a|0)==9734){break G}if((a|0)==9824){va=130;return-2147483520}c=-2147483520;d=128;if(a-9825>>>0<2){break Q}b=a-9827|0;if(b>>>0<6){break Ba}break ra;case 8:c=-2147483648;if(a>>>0<=9861){break qa}break Q;case 10:c=-2147483648;d=130;zg:{switch(a-9888|0){case 1:break i;case 0:break Q;default:break zg}}d=134;if((a&-2)!=9898){break qa}break Q;case 11:c=-2147483648;d=130;if((a&-2)==9904){break Q}d=134;if(a-9917>>>0>=2){break qa}break Q;case 12:if((a&-2)==9924){break i}c=-2147483648;d=130;Ag:{switch(a-9928|0){case 0:case 7:break Q;case 6:break Ag;default:break qa}}break i;case 14:b=(a|0)==9962;a=(a|0)==9961;c=a?-2147483648:-2147483648;va=a?130:b?134:128;break m;case 13:break ya;case 9:break za;case 15:break wg;case 7:break Aa;case 1:break Da;default:break qa}}if((a|0)==9972|a>>>0<9970){break B}c=-2147483648;d=134;if(a>>>0<9974){break Q}if((a|0)!=9974){d=130;if(a>>>0<9977){break Q}}a=a-9977|0;if(a>>>0<5){break xa}break qa}Bg:{Cg:{Dg:{Eg:{Fg:{switch((a&-16)-9984>>>4|0){case 0:c=0;d=130;if((a|0)==9986){break Bg}d=128;if(a>>>0<9989){break Bg}d=134;if((a|0)==9989){break Bg}d=150;Gg:{switch((a&-2)-9994|0){case 0:break Bg;case 2:break Dg;default:break Gg}}d=130;if(a-9992>>>0<6){break Bg}b=(a|0)==9999;a=(a|0)==9998;c=a?0:b&0;d=a?128:b?130:0;break Bg;case 1:c=0;d=128;if(a>>>0<10002){break Bg}a=a-10002|0;if(a>>>0>11){break Eg}d=130;if(!(1<<a&2069)){break Eg}break Bg;case 2:b=(a|0)==10024;a=(a|0)==10017;c=a?0:b&0;d=a?130:b?134:0;break Bg;case 4:c=0;d=130;Hg:{switch(a-10052|0){case 0:case 3:break Bg;case 8:case 10:break Hg;default:break Eg}}d=134;break Bg;case 5:c=0;d=1073741958;if(a-10067>>>0<2){break Bg}a=a-10069&-3;d=a?0:536871046;break Bg;case 6:b=a-10082|0;if(b>>>0<3){break Cg}c=0;d=128;if(a>>>0<=10084){break Eg}break Bg;case 9:c=0;d=134;if(a-10133>>>0>=3){break Eg}break Bg;case 10:c=0;d=130;if((a|0)!=10145){break Eg}break Bg;case 11:b=(a|0)==10175;a=(a|0)==10160;c=a?0:b&0;d=a?134:b?134:0;break Bg;case 3:break Fg;default:break Eg}}c=0;d=130;if(a-10035>>>0<2){break Bg}}c=0;d=0;break Bg}d=146;break Bg}a=(b<<3)+83992|0;c=K[a>>2];d=K[a+4>>2]}va=d;return c|-2147483648}c=-2147483648;d=130;if(a-11013>>>0<3){break Q}d=134;if(a-11035>>>0<2){break Q}b=(a|0)==11093;a=(a|0)==11088;c=a?-2147483648:-2147483648;va=a?134:b?134:0;break m}if(a-11904>>>0>=26){break Yf}va=0;return 1048576}if(a-12276>>>0>=8){break N}break Q}a=a-12306|0;if(a>>>0>14){break N}c=-2147483648;if(!(1<<a&16387)){break N}break Q}a=a-12951&-3;b=0;va=a?0:130;break j}c=0;d=128;if((a|0)==127279){break Q}if(a-127280>>>0<26){va=0;return 33792}if(a-127312>>>0<26){va=0;return 33792}b=a-127344|0;if(b>>>0<=15){c=33792;d=130;if(1<<b&49155){break Q}}c=33792;d=0;if(b>>>0<26){break Q}if((a|0)==127374){break A}c=0;d=134;if(a-127377>>>0<10){break Q}d=102;if(a>>>0<=127461){break N}break Q}c=0;d=134;Ig:{Jg:{switch(a-127489|0){case 0:case 25:break Q;case 1:break C;case 2:case 3:case 4:case 5:case 6:case 7:case 8:case 9:case 10:case 11:case 12:case 13:case 14:case 15:case 16:case 17:case 18:case 19:case 20:case 21:case 22:case 23:case 24:break Ig;default:break Jg}}switch(a-127535|0){case 0:break Q;case 8:break C;default:break Ig}}if((a&-2)==127568|a-127538>>>0<9){break Q}d=128;if(a>>>0<=127583){break N}break Q}if((a|0)==127777){break C}if(a-127789>>>0<9|a-127799>>>0<70){break A}if((a|0)==127877){break z}if(a-127870>>>0<22){break A}if(a-127780>>>0<112){break C}c=0;d=130;Kg:{switch(a-127894|0){case 44:case 45:case 46:case 49:break z;case 0:case 1:case 3:case 4:case 5:break Q;default:break Kg}}if(a-127904>>>0<42){break A}d=150;if((a|0)==127946){break Q}d=146;if(a-127947>>>0<2){break Q}if(a-127951>>>0<5){break A}d=134;if(a-127968>>>0<17){break Q}d=130;if(a-127902>>>0<83){break Q}b=a-127987|0;if(b>>>0<5){break wa}break sa}c=0;d=130;Lg:{switch(a-128063|0){case 0:case 2:break Q;default:break Lg}}if((a|0)==128124|(a&-5)-128129>>>0<3|((a|0)==128110|a-128112>>>0<9)){break z}if((a&-2)==128066|a-128102>>>0<4|a-128070>>>0<11){break z}Mg:{switch(a-128253|0){case 1:va=128;break g;case 0:break C;default:break Mg}}d=150;if((a|0)==128170){break Q}break A}if(a>>>0<128318){break A}c=0;if(a>>>0<128326){break Q}if(a-128329>>>0<2){break C}if(a-128331>>>0<4|a-128336>>>0<24){break A}if(a-128367>>>0<2){break C}if((a&-2)==128372){va=146;break g}if(a-128371>>>0<7){break C}d=150;b=a-128378|0;if(!b){break Q}if((b|0)==13|a-128394>>>0<4){break C}d=146;if((a|0)==128400){break Q}d=150;if(a-128405>>>0<2){break Q}d=134;Ng:{switch(a-128420|0){case 0:break Q;case 1:case 4:case 13:case 14:case 24:case 30:case 31:case 32:case 45:case 46:case 47:case 56:case 57:case 58:case 61:case 63:case 68:case 75:case 79:case 86:break C;default:break Ng}}a=a>>>0>128506;b=a&0;break k}c=0;d=128;if(a-128981>>>0>=4){break N}break Q}if(a>>>0<129292){break N}if(a-129328>>>0<10){break z}c=0;d=150;Og:{switch(a-129304|0){case 35:break N;case 0:case 1:case 2:case 3:case 4:case 6:case 7:case 14:break Q;default:break Og}}if(a-129341>>>0<2){break z}d=0;if((a|0)==129350){break Q}d=198;if((a&-4)==129456){break Q}b=a-129461|0;if(b>>>0<5){break ua}break ta}c=1048576;if(a-11931>>>0<89){break Q}break N}va=0;return 524288;case 29:va=16777216;return 1073741825;case 28:break Q;case 30:break Wa;default:break N}}va=0;return(a|0)==32?1073741825:1}if(!(1079>>>b&1)){break R}a=(b<<3)+81344|0;b=K[a>>2];break o}if(557553>>>b&1){break K}if((a&-4)!=8508){break _}break Q}if(!(207>>>b&1)){break aa}break H}c=1024;if(!(1017>>>b&1)){break ba}break Q}c=1024;if(!(32895>>>b&1)){break da}break Q}c=1024;if(!(55>>>b&1)){break ea}break Q}c=1024;if(!(3087>>>b&1)){break ga}break Q}a=a-71453|0;if(a>>>0>=15){break N}a=(a<<3)+82312|0;b=K[a>>2];break o}if(!(49023>>>b&1)){break ha}a=(b<<3)+82432|0;b=K[a>>2];break o}if(!(514623>>>b&1)){break $}a=(b<<3)+82664|0;b=K[a>>2];break o}a=(b<<3)+83160|0;b=K[a>>2];break o}c=268435520;if(!(197>>>b&1)){break ia}break Q}a=(b<<3)+83208|0;b=K[a>>2];break o}a=a-6145|0;if(a>>>0>=10){break N}a=(a<<3)+83296|0;b=K[a>>2];break o}if(!(1077711>>>b&1)){break la}a=(b<<3)+83376|0;b=K[a>>2];break o}if(!(159>>>b&1)){break ja}a=(b<<3)+83544|0;b=K[a>>2];break o}a=a-121479|0;if(a>>>0>=4){break N}a=(a<<3)+83608|0;b=K[a>>2];break o}if(!(195>>>b&1)){break pa}break G}a=a-9745|0;if(a>>>0>=13){break qa}a=(a<<3)+83640|0;b=K[a>>2];break o}if(1101>>>b&1){break B}c=-2147483648;d=130;if(a>>>0<=9773){break qa}break Q}if(!(45>>>b&1)){break ra}a=(b<<3)+83744|0;b=K[a>>2];break o}a=a-9851|0;if(a>>>0>=5){break qa}a=(a<<3)+83792|0;b=K[a>>2];break o}a=a-9874|0;if(a>>>0>=11){break qa}a=(a<<3)+83832|0;b=K[a>>2];break o}a=a-9937|0;if(a>>>0>=4){break qa}a=(a<<3)+83920|0;b=K[a>>2];break o}a=(a<<3)+83952|0;b=K[a>>2];break o}if(!(23>>>b&1)){break sa}a=(b<<3)+84016|0;b=K[a>>2];break o}c=0;d=150;if(!(1991>>>b&1)){break oa}break Q}d=150;if(!(27>>>b&1)){break ta}break Q}a=a-129489>>>0<13;b=a&0;va=a?150:134;break j}a=a-127992>>>0<3;b=a&0;break k}if(a-9837>>>0<2){break Q}}va=128;break h}if(a-8623>>>0<13){break M}if(a-8636>>>0<18){break G}b=a-8656|0;if(b>>>0<22){d=0;if(3157995>>>b&1){break Q}}c=-2147483648;d=0;if(a-8661>>>0<31){break Q}break N}if(a>>>0<128592){break A}c=0;d=0;if(a>>>0<128640){break Q}b=a-128675|0;if(!(b>>>0>29|!(1<<b&537788417))){break z}if(a>>>0<128710){break A}d=150;if((a|0)==128716){break Q}if(a-128715>>>0<5){break C}if(a-128720>>>0<3){break A}b=a-128736|0;if(!(b>>>0>=10|!(575>>>b&1))){break C}d=134;if(a-128747>>>0<2){break Q}d=130;Pg:{switch(a-128752|0){case 0:case 3:break Q;default:break Pg}}a=a-128756>>>0<6;b=a&0;break k}c=-2147483648;Qg:{switch(a-8260|0){case 1:case 2:case 3:case 4:case 5:case 6:case 7:case 8:case 9:case 10:case 11:case 12:case 13:break N;case 0:case 14:break Q;default:break Qg}}a=a-8315|0;if((a|0)!=16?a:0){break N}va=0;return 8}c=268435520;d=1073741824;if((a|0)!=69955){break N}break Q}if(a-8266>>>0<8){break M}c=-2147483640;if((a|0)==8275){break Q}c=-2147483648;if(a-8277>>>0>=10){break N}break Q}va=542113792;break h}c=-2147483648;d=0;if(a-65093>>>0<2){break Q}c=64;d=268435456;if((f|0)==65104){break Q}c=268435520;d=-2147483648;Rg:{switch(a-65106|0){case 3:va=134217728;break b;case 5:va=536870912;break d;case 4:break f;case 2:break c;case 0:break Q;case 15:case 22:break Rg;default:break N}}break K}if((a|0)==2142){break D}c=64;if(a-2096>>>0<15){break Q}break N}c=1024;if(a-72850>>>0<22){break Q}a=a-72874|0;if(a>>>0>=13){break N}a=(a<<3)+82560|0;b=K[a>>2];break o}c=4096;if(a-71103>>>0<2){break Q}c=1024;if((a&-2)!=71132){break N}break Q}if((a|0)==70726){break I}c=4096;if((a&-2)!=70850){break N}break Q}c=4096;if(a-68325>>>0>=2){break N}break Q}if((a|0)==6109){break I}c=4096;if(a-6089>>>0>=11){break N}break Q}Sg:{switch(a-3959|0){case 0:case 2:va=0;return 8389632;default:break Sg}}if((b|0)==3968|a-3953>>>0<14){break H}b=a-3970|0;if(!(b>>>0>=6|!(55>>>b&1))){break I}if(a-3981>>>0<11){break H}c=1024;if(a-3993>>>0<36){break Q}c=4096;if((a|0)!=4038){break N}break Q}if(a-3655>>>0<6){break I}b=a-3761|0;if(!(b>>>0>11|!(1<<b&3577))){break H}c=1024;Tg:{switch(a-3661|0){case 1:break I;case 0:break Q;default:break Tg}}c=4096;if(a-3784>>>0<5){break Q}c=1024;if((a|0)!=3789){break N}break Q}if(a-1770>>>0<3){break Q}c=1024;if((a|0)!=1773){break N}break Q}if((a&-2)==73028){break I}c=1024;Ug:{switch(a-73104|0){default:if((a|0)!=73031){break N}break Q;case 2:case 3:case 4:case 6:break N;case 0:case 1:case 5:break Q;case 7:break Ug}}break I}a=a-8492|0;if(a>>>0>=30){break N}a=(a<<3)+81704|0;b=K[a>>2];break o}c=0;break X}b=(a&-3)==43712;d=b>>>20|0;c=b<<12}e=a&-65536;if((e|0)==131072){break V}if((e|0)==65536){break U}b=c;f=d;if(e){break T}}if(a-13312>>>0<6582){break a}if(a-19968>>>0<20976){break a}e=2048;if(a-63744>>>0<366){va=f;return b|2048}c=b;d=f;if(a-64112>>>0>=106){break T}break S}e=2099200;if(a-183984>>>0<7473|a-178208>>>0<5762|(a-177984>>>0<222|a-131072>>>0<42711)){break S}if(a-173824>>>0<4149){break S}e=2048;if(a-194560>>>0<542){break S}break T}e=2048;if(a-110960>>>0<396|a-94208>>>0<6125|a-100352>>>0<755){break S}}e=0}va=d;return c|e}if((a&-4)==8508){break K}c=128;if(a-8517>>>0<3){break Q}c=16777344;if((a&-2)==8520){break Q}break N}va=d;break m}a=a>>>0>131069;b=a?65536:0;va=a?0:128;break j}if((a|0)==11776){break M}}va=0;break g}va=0;break h}va=0;return 4194304}va=0;return 128}va=0;return 16777344}va=0;return 4096}va=0;return 1024}va=0;return-2147483520}va=0;return a-10214>>>0<10?-2147483520:-2147483648}va=0;break d}va=0;break b}va=130;break g}va=130;break h}va=134;break g}va=150;return 0}va=0;break j}va=a?0:d;break j}va=b;return a}return 131072}va=0;return 16777216}va=a?0:c;break j}va=d;return a}va=c;return a}va=a?0:b;break m}va=0;return 8192}va=K[a+4>>2];break j}va=a?8388608:0;break j}return c}va=0;return-2147483616}va=a?134:128}return b}va=134}return-2147483648}return 0}va=1073741824;break d}va=-2147483648}return 268435520}va=67108864}return 64}va=f;return b|2099200}
      function nd(a){var b=0,c=0,d=0,e=0,f=0,g=0;b=Qa(8244);if(b){K[b+328>>2]=2;I[132848]=0;K[b+684>>2]=0;K[b+688>>2]=0;K[b+320>>2]=0;K[b+324>>2]=0;I[b+268|0]=0;I[b+228|0]=0;K[b+8216>>2]=0;K[b+8220>>2]=0;K[b+224>>2]=104944;K[b+216>>2]=383;K[b+220>>2]=96;Ea(b+344|0,0,292);K[b+8196>>2]=0;c=b+8188|0;K[c>>2]=0;K[c+4>>2]=0;K[b+8180>>2]=0;K[b+8184>>2]=0;I[b+460|0]=22;I[b+461|0]=129;I[b+466|0]=38;I[b+462|0]=38;I[b+463|0]=36;I[b+464|0]=22;I[b+465|0]=224;I[b+456|0]=22;I[b+457|0]=22;I[b+458|0]=44;I[b+459|0]=22;I[b+454|0]=46;I[b+455|0]=129;I[b+446|0]=22;I[b+447|0]=38;I[b+448|0]=28;I[b+449|0]=193;I[b+450|0]=38;I[b+451|0]=22;I[b+452|0]=46;I[b+453|0]=46;I[b+441|0]=129;I[b+442|0]=38;I[b+443|0]=22;I[b+444|0]=38;I[b+445|0]=193;K[b+332>>2]=104912;K[b+336>>2]=104916;K[b+340>>2]=105232;I[b+296|0]=18;I[b+297|0]=18;J[b+304>>1]=182;J[b+306>>1]=140;I[b+298|0]=20;J[b+308>>1]=220;J[b+310>>1]=220;J[b+312>>1]=220;I[b+299|0]=20;I[b+300|0]=20;J[b+314>>1]=240;I[b+301|0]=22;J[b+316>>1]=260;J[b+318>>1]=280;I[b+302|0]=22;I[b+303|0]=20;c=Ea(b,0,212);K[c+200>>2]=20;K[c+192>>2]=25966;K[c+196>>2]=500;K[c+80>>2]=95;K[c+16>>2]=1;K[c+20>>2]=3;K[c+8>>2]=2;K[c+52>>2]=19;I[c+168|0]=3;K[c+92>>2]=2;K[c+72>>2]=4;K[c+40>>2]=115;K[c+44>>2]=95;K[c+140>>2]=105244;yd(c,201);K[c+120>>2]=2;K[c+124>>2]=44;K[c+164>>2]=100;K[c+128>>2]=46;K[c+132>>2]=14;K[c+112>>2]=1227133512;K[c+116>>2]=49;K[c+104>>2]=1;d=K[26313];K[c+636>>2]=K[26312];K[c+640>>2]=d;d=K[26315];K[c+644>>2]=K[26314];K[c+648>>2]=d;d=K[26317];K[c+652>>2]=K[26316];K[c+656>>2]=d;d=K[26319];K[c+660>>2]=K[26318];K[c+664>>2]=d;d=K[26321];K[c+668>>2]=K[26320];K[c+672>>2]=d;d=K[26323];K[c+676>>2]=K[26322];K[c+680>>2]=d;d=L[104928]|L[104929]<<8;I[c+160|0]=d;I[c+161|0]=d>>>8;d=L[104924]|L[104925]<<8|(L[104926]<<16|L[104927]<<24);I[c+156|0]=d;I[c+157|0]=d>>>8;I[c+158|0]=d>>>16;I[c+159|0]=d>>>24}e=Ca(b+228|0,a);c=0;a:{b:{d=L[a|0];if(!d){break b}while(1){c=(d<<24>>24)+(c<<8)|0;a=a+1|0;d=L[a|0];if(d){continue}break}c:{d:{e:{f:{g:{h:{i:{j:{k:{l:{m:{n:{o:{p:{q:{r:{s:{t:{u:{v:{w:{x:{y:{z:{A:{B:{C:{D:{E:{F:{G:{H:{I:{J:{K:{L:{M:{N:{O:{P:{Q:{R:{S:{T:{U:{V:{W:{X:{Y:{Z:{_:{$:{aa:{ba:{ca:{da:{ea:{fa:{ga:{ha:{ia:{ja:{ka:{la:{ma:{na:{oa:{pa:{qa:{ra:{if((c|0)<=28008){if((c|0)<=26464){if((c|0)<=25696){sa:{switch(c-24934|0){case 20:break j;case 1:case 2:case 3:case 4:case 5:case 6:case 9:case 10:case 11:case 14:case 15:case 16:case 17:case 18:case 19:break b;case 8:break $;case 12:break ia;case 7:break ja;case 0:break ka;case 13:break ra;default:break sa}}ta:{switch(c-25189|0){case 1:case 3:case 4:case 5:case 6:case 7:case 8:case 10:case 11:case 12:case 13:break b;case 14:break R;case 2:break ga;case 0:break ha;case 9:break ra;default:break ta}}switch(c-25441|0){case 18:break r;case 0:break $;case 24:break ea;default:break b}}ua:{switch(c-25964|0){case 1:case 4:case 5:case 6:break b;case 8:break Y;case 9:break _;case 7:break $;case 3:break aa;case 2:break ba;case 0:break pa;default:break ua}}va:{switch(c-26209|0){case 1:case 2:case 3:case 4:case 5:case 6:case 7:case 9:case 10:case 11:case 12:case 13:case 14:case 15:case 16:break b;case 17:break W;case 8:break X;case 0:break Z;default:break va}}switch(c-25697|0){case 4:break ca;case 0:break da;default:break b}}if((c|0)<=27488){wa:{switch(c-26729|0){case 1:case 2:case 3:case 4:case 5:case 6:case 7:case 8:case 10:case 13:case 14:case 15:break b;case 16:break O;case 12:break P;case 11:break Q;case 9:break R;case 0:break S;default:break wa}}xa:{switch(c-26977|0){case 1:case 2:case 4:case 5:case 6:case 7:case 8:case 9:case 10:case 11:case 12:case 13:case 15:case 16:case 17:break b;case 19:break K;case 18:break L;case 3:break M;case 14:break N;case 0:break $;default:break xa}}switch(c-26465|0){case 20:break S;case 13:break T;case 0:case 3:break U;default:break b}}ya:{switch(c-27489|0){case 13:break k;case 1:case 2:case 3:case 4:case 5:case 6:case 7:case 8:case 9:case 12:case 15:case 16:case 17:case 18:case 19:case 21:case 22:case 23:break b;case 24:break D;case 20:break E;case 14:break F;case 11:break G;case 10:break H;case 0:break I;default:break ya}}switch(c-27745|0){case 19:break B;case 0:break C;case 21:break na;default:break b}}if((c|0)<=29792){if((c|0)<=28768){za:{switch(c-28009|0){case 3:break k;case 11:break z;case 2:break A;case 1:case 4:case 5:case 6:case 7:case 8:case 12:case 13:case 14:case 15:break b;case 10:break M;case 9:break S;case 0:case 16:break la;default:break za}}Aa:{switch(c-28258|0){case 0:break x;case 10:break y;case 1:case 2:case 4:case 5:case 6:case 7:case 8:case 9:break b;case 3:break S;default:break Aa}}switch(c-28525|0){case 0:break w;case 5:break S;default:break b}}if((c|0)<=29539){Ba:{switch(c-28769|0){case 19:break u;case 11:break v;case 1:case 2:case 3:case 4:case 5:case 6:case 7:case 8:case 9:case 10:case 12:case 13:case 14:case 15:case 16:case 17:case 18:case 20:case 21:case 22:case 23:break b;case 0:break S;case 24:break la;default:break Ba}}Ca:{switch(c-29295|0){case 6:break s;case 0:break t;case 1:case 2:case 3:case 4:case 5:break b;default:break Ca}}if((c|0)==29045){break la}break b}switch(c-29540|0){case 19:break l;case 18:break m;case 13:break n;case 8:break p;case 5:break q;case 7:break r;case 14:break R;case 0:break g;default:break b}}if((c|0)>6514801){break qa}if((c|0)<=30058){switch(c-29793|0){case 19:break i;case 17:break j;case 0:case 4:break k;case 13:break l;case 7:break la;default:break b}}if((c|0)<=30312){switch(c-30059|0){case 0:break h;case 15:break la;case 7:break g;default:break b}}if((c|0)==30313){break f}if((c|0)==31336){break e}if((c|0)!=6451321){break b}}K[b+296>>2]=303174162;K[b+300>>2]=370545684;K[b+600>>2]=2432;K[b+8>>2]=0;K[b+12>>2]=65540;K[b+100>>2]=K[b+96>>2];a=K[25889];K[b+304>>2]=K[25888];K[b+308>>2]=a;a=K[25891];K[b+312>>2]=K[25890];K[b+316>>2]=a;Yb(b);I[b+345|0]=L[b+345|0]|2;I[b+406|0]=L[b+406|0]|16;I[b+407|0]=L[b+407|0]|16;I[b+408|0]=L[b+408|0]|16;I[b+409|0]=L[b+409|0]|16;I[b+410|0]=L[b+410|0]|16;I[b+411|0]=L[b+411|0]|16;I[b+412|0]=L[b+412|0]|16;I[b+413|0]=L[b+413|0]|16;I[b+414|0]=L[b+414|0]|16;I[b+415|0]=L[b+415|0]|16;I[b+416|0]=L[b+416|0]|16;I[b+417|0]=L[b+417|0]|16;I[b+418|0]=L[b+418|0]|16;I[b+419|0]=L[b+419|0]|16;I[b+420|0]=L[b+420|0]|16;I[b+456|0]=L[b+456|0]|4;I[b+457|0]=L[b+457|0]|4;K[b+112>>2]=613567144;K[b+104>>2]=16;if((c|0)!=6451321){break a}K[b+104>>2]=1;K[b+108>>2]=512;c=6451321;break a}if((c|0)>7364975){break ma}if((c|0)>6840682){break oa}if((c|0)==6514802){break fa}if((c|0)==6516078){break e}if((c|0)!=6779491){break b}}K[b+600>>2]=896;K[b+328>>2]=8;K[b+296>>2]=336858127;K[b+300>>2]=353768980;K[b+332>>2]=103632;a=K[25905];K[b+304>>2]=K[25904];K[b+308>>2]=a;a=K[25907];K[b+312>>2]=K[25906];K[b+316>>2]=a;Ea(b+344|0,0,256);I[b+388|0]=129;I[b+389|0]=129;I[b+390|0]=129;I[b+391|0]=129;I[b+420|0]=129;I[b+421|0]=129;I[b+422|0]=129;I[b+423|0]=129;I[b+360|0]=129;I[b+392|0]=129;I[b+393|0]=129;I[b+417|0]=129;I[b+418|0]=129;I[b+419|0]=129;I[b+420|0]=129;I[b+408|0]=6;I[b+409|0]=4;I[b+410|0]=6;I[b+411|0]=6;I[b+412|0]=6;I[b+413|0]=193;I[b+414|0]=6;I[b+415|0]=6;I[b+406|0]=6;I[b+407|0]=129;I[b+398|0]=4;I[b+399|0]=193;I[b+400|0]=6;I[b+401|0]=193;I[b+402|0]=6;I[b+403|0]=4;I[b+404|0]=4;I[b+405|0]=4;I[b+394|0]=4;I[b+395|0]=4;I[b+396|0]=4;I[b+397|0]=193;K[b+44>>2]=130;K[b+8>>2]=2;K[b+12>>2]=6;K[b+16>>2]=0;K[b+20>>2]=2;K[b+104>>2]=264;K[b+108>>2]=6146;I[b+391|0]=193;I[b+389|0]=193;I[b+390|0]=193;I[b+421|0]=193;K[b+100>>2]=K[b+96>>2];I[b+416|0]=L[b+416|0]|4;if((c|0)!=6779491){break a}K[b+40>>2]=1;c=6779491;break a}if((c|0)==6840683){break V}if((c|0)==6972015){break J}if((c|0)!=7107687){break b}}K[b+296>>2]=134875662;K[b+300>>2]=252968960;K[b+328>>2]=5;I[b+169|0]=1;K[b+132>>2]=33;K[b+104>>2]=99336;K[b+8>>2]=0;K[b+12>>2]=262182;a=K[26069];K[b+304>>2]=K[26068];K[b+308>>2]=a;a=K[26071];K[b+312>>2]=K[26070];K[b+316>>2]=a;break a}if((c|0)<=7564649){if((c|0)==7364976){break $}if((c|0)==7435619){break la}if((c|0)!=7563374){break b}K[b+148>>2]=1;K[b+112>>2]=24;K[b+104>>2]=1;K[b+100>>2]=K[b+96>>2];c=7563374;break a}if((c|0)==7564650){break o}if((c|0)==7959909){break e}if((c|0)!=1885958500){break b}}K[b+104>>2]=0;break a}K[b+4>>2]=48;K[b+8>>2]=0;K[b+144>>2]=1;K[b+104>>2]=16779472;K[b+32>>2]=1;K[b+24>>2]=1;a=K[25881];K[b+304>>2]=K[25880];K[b+308>>2]=a;a=K[25883];K[b+312>>2]=K[25882];K[b+316>>2]=a;I[b+465|0]=L[b+465|0]&64|129;c=24934;break a}K[b+600>>2]=4608;K[b+296>>2]=303173650;K[b+300>>2]=303174162;K[b+8>>2]=0;K[b+12>>2]=36;K[b+104>>2]=1024;K[b+100>>2]=K[b+96>>2];K[b+40>>2]=1;a=K[25865];K[b+304>>2]=K[25864];K[b+308>>2]=a;a=K[25867];K[b+312>>2]=K[25866];K[b+316>>2]=a;c=24941;break a}K[b+600>>2]=1536;K[b+224>>2]=0;K[b+216>>2]=1631;K[b+220>>2]=1536;K[b+104>>2]=2884720;K[b+328>>2]=7;K[b+40>>2]=1;c=sa-16|0;sa=c;K[c+12>>2]=-1;a=89684;while(1){e=Ga(c+12|0,a);d=K[c+12>>2];if((d|0)>=33){f=(b+d|0)-1192|0;I[f|0]=L[f|0]|1}a=a+e|0;if(d){continue}break}K[c+12>>2]=-1;a=89743;while(1){e=Ga(c+12|0,a);d=K[c+12>>2];if((d|0)>=33){f=(b+d|0)-1192|0;I[f|0]=L[f|0]|2}a=a+e|0;if(d){continue}break}K[c+12>>2]=-1;a=89795;while(1){e=Ga(c+12|0,a);d=K[c+12>>2];if((d|0)>=33){f=(b+d|0)-1192|0;I[f|0]=L[f|0]|4}a=a+e|0;if(d){continue}break}K[c+12>>2]=-1;a=89941;while(1){e=Ga(c+12|0,a);d=K[c+12>>2];if((d|0)>=33){f=(b+d|0)-1192|0;I[f|0]=L[f|0]|16}a=a+e|0;if(d){continue}break}K[c+12>>2]=-1;a=90045;while(1){e=Ga(c+12|0,a);d=K[c+12>>2];if((d|0)>=33){f=(b+d|0)-1192|0;I[f|0]=L[f|0]|32}a=a+e|0;if(d){continue}break}K[c+12>>2]=-1;a=90045;while(1){e=Ga(c+12|0,a);d=K[c+12>>2];if((d|0)>=33){f=(b+d|0)-1192|0;I[f|0]=L[f|0]|8}a=a+e|0;if(d){continue}break}K[c+12>>2]=-1;a=90045;while(1){e=Ga(c+12|0,a);d=K[c+12>>2];if((d|0)>=33){f=(b+d|0)-1192|0;I[f|0]=L[f|0]|64}a=a+e|0;if(d){continue}break}sa=c+16|0;c=24946;break a}K[b+600>>2]=1056;K[b+12>>2]=34;K[b+216>>2]=1118;K[b+220>>2]=1072;Ea(b+344|0,0,256);I[b+406|0]=4;I[b+366|0]=4;I[b+367|0]=4;I[b+369|0]=4;I[b+370|0]=4;I[b+371|0]=4;I[b+372|0]=4;I[b+361|0]=4;I[b+362|0]=4;I[b+363|0]=4;I[b+364|0]=4;I[b+373|0]=4;I[b+380|0]=4;I[b+381|0]=4;I[b+382|0]=4;I[b+383|0]=4;I[b+375|0]=4;I[b+376|0]=4;I[b+377|0]=4;I[b+378|0]=4;I[b+384|0]=4;I[b+360|0]=129;K[b+328>>2]=6;K[b+296>>2]=134744588;K[b+300>>2]=286261248;K[b+40>>2]=1;K[b+8>>2]=0;K[b+104>>2]=1032;K[b+108>>2]=66;a=K[25885];K[b+304>>2]=K[25884];K[b+308>>2]=a;a=K[25887];K[b+312>>2]=K[25886];K[b+316>>2]=a;c=25189;break a}md(b);K[b+328>>2]=6;K[b+56>>2]=2;K[b+36>>2]=263;K[b+40>>2]=1074;K[b+124>>2]=32;K[b+104>>2]=184554728;K[b+8>>2]=2;I[b+386|0]=L[b+386|0]&64|129;c=25191;break a}K[b+12>>2]=262182;K[b+40>>2]=1;c=6514802;break a}K[b+328>>2]=14;K[b+296>>2]=303173393;K[b+300>>2]=336986112;K[b+104>>2]=1024;K[b+16>>2]=0;K[b+20>>2]=2;K[b+8>>2]=2;K[b+12>>2]=22;K[b+44>>2]=120;a=K[25893];K[b+304>>2]=K[25892];K[b+308>>2]=a;a=K[25895];K[b+312>>2]=K[25894];K[b+316>>2]=a;I[b+463|0]=L[b+463|0]&64|129;I[b+465|0]=L[b+465|0]&64|129;c=25465;break a}K[b+8>>2]=0;K[b+104>>2]=184618072;K[b+32>>2]=1;a=K[26101];K[b+304>>2]=K[26100];K[b+308>>2]=a;a=K[26103];K[b+312>>2]=K[26102];K[b+316>>2]=a;I[b+465|0]=L[b+465|0]&64|129;c=25697;break a}K[b+296>>2]=336860180;K[b+300>>2]=336991764;K[b+8>>2]=0;K[b+104>>2]=16846872;K[b>>2]=8;K[b+4>>2]=48;K[b+80>>2]=87;K[b+32>>2]=1;K[b+36>>2]=256;K[b+40>>2]=2;a=K[25897];K[b+304>>2]=K[25896];K[b+308>>2]=a;a=K[25899];K[b+312>>2]=K[25898];K[b+316>>2]=a;I[b+465|0]=L[b+465|0]&64|129;c=25701;break a}K[b+132>>2]=33;K[b+104>>2]=16779328;K[b+8>>2]=0;K[b+12>>2]=8;K[b+204>>2]=101;K[b+60>>2]=2;K[b+40>>2]=2;a=K[25901];K[b+304>>2]=K[25900];K[b+308>>2]=a;a=K[25903];K[b+312>>2]=K[25902];K[b+316>>2]=a;I[b+441|0]=L[b+441|0]|64;I[b+445|0]=L[b+445|0]|64;I[b+449|0]=L[b+449|0]|64;I[b+455|0]=L[b+455|0]|64;I[b+461|0]=L[b+461|0]|64;I[b+465|0]=L[b+465|0]|64;c=25966;break a}K[b+328>>2]=4;K[b+296>>2]=336858640;K[b+300>>2]=353768980;K[b+104>>2]=16782344;K[b+20>>2]=2;K[b+12>>2]=22;K[b+4>>2]=2;K[b+8>>2]=2;K[b+332>>2]=103640;a=K[25997];K[b+304>>2]=K[25996];K[b+308>>2]=a;a=K[25999];K[b+312>>2]=K[25998];K[b+316>>2]=a;c=25967;break a}K[b+296>>2]=269422096;K[b+300>>2]=370545684;K[b+104>>2]=86017320;K[b+108>>2]=6144;K[b+16>>2]=0;K[b+20>>2]=2;K[b+8>>2]=2;K[b+12>>2]=534;K[b+100>>2]=K[b+96>>2];K[b+44>>2]=120;a=K[25913];K[b+304>>2]=K[25912];K[b+308>>2]=a;a=K[25915];K[b+312>>2]=K[25914];K[b+316>>2]=a;Da:{Ea:{if((c|0)<=26976){if((c|0)==24942){break Ea}if((c|0)!=25441){break Da}K[b+12>>2]=566;K[b+336>>2]=103664;c=25441;break a}if((c|0)!=26977){if((c|0)!=7364976){break Da}K[b+8>>2]=3;K[b+12>>2]=310;c=7364976;break a}K[b+104>>2]=85984264;c=26977;break a}K[b+104>>2]=153093416;K[b+108>>2]=2048;K[b+140>>2]=103676;c=24942;break a}K[b+40>>2]=2;break a}K[b+296>>2]=303173648;K[b+300>>2]=303174162;K[b+104>>2]=3147080;K[b+12>>2]=65792;K[b+84>>2]=1;a=K[25921];K[b+304>>2]=K[25920];K[b+308>>2]=a;a=K[25923];K[b+312>>2]=K[25922];K[b+316>>2]=a;c=25973;break a}K[b+600>>2]=1536;K[b+216>>2]=1740;K[b+220>>2]=1568;K[b+104>>2]=96;K[b+224>>2]=103696;K[b+340>>2]=103872;K[b+40>>2]=1;c=26209;break a}K[b+328>>2]=5}K[b+104>>2]=86024;K[b+164>>2]=130;I[b+465|0]=L[b+465|0]&64|129;break a}K[b+296>>2]=303173650;K[b+300>>2]=303174162;K[b+8>>2]=3;K[b+12>>2]=36;K[b+144>>2]=2;K[b+104>>2]=118658312;K[b+28>>2]=1;K[b+100>>2]=K[b+96>>2];a=K[25865];K[b+304>>2]=K[25864];K[b+308>>2]=a;a=K[25867];K[b+312>>2]=K[25866];K[b+316>>2]=a;I[b+465|0]=L[b+465|0]&64|129;c=26226;break a}J[b+170>>1]=257;K[b+148>>2]=1;K[b+12>>2]=2;c=6840683;break a}K[b+144>>2]=2;K[b+104>>2]=2098176;K[b+8>>2]=0;K[b+12>>2]=32;K[b+40>>2]=3;K[b+28>>2]=1;break a}K[b+8>>2]=3;K[b+100>>2]=K[b+96>>2];c=26478;break a}K[b+328>>2]=18;K[b+296>>2]=320081425;K[b+300>>2]=353768980;K[b+600>>2]=2304;K[b+112>>2]=84648;K[b+104>>2]=16;K[b+8>>2]=6;K[b+12>>2]=65540;K[b+100>>2]=K[b+96>>2];a=K[25973];K[b+304>>2]=K[25972];K[b+308>>2]=a;a=K[25975];K[b+312>>2]=K[25974];K[b+316>>2]=a;Fa:{Ga:{Ha:{if((c|0)<=28529){if((c|0)==26485){break Ha}if((c|0)!=28261){break Fa}a=K[25861];K[b+304>>2]=K[25860];K[b+308>>2]=a;a=K[25863];K[b+312>>2]=K[25862];K[b+316>>2]=a;K[b+296>>2]=320017171;K[b+300>>2]=320017171;K[b+132>>2]=22;K[b+112>>2]=-1431655768;K[b+108>>2]=K[b+108>>2]|32768;Yb(b);break a}if((c|0)==28530){break Ga}if((c|0)!=28769){break Fa}K[b+600>>2]=2560;Yb(b);break a}a=K[25861];K[b+304>>2]=K[25860];K[b+308>>2]=a;a=K[25863];K[b+312>>2]=K[25862];K[b+316>>2]=a;K[b+600>>2]=2688;K[b+296>>2]=320017171;K[b+300>>2]=320017171;K[b+8>>2]=2;Yb(b);break a}K[b+600>>2]=2816}Yb(b);break a}I[e|0]=104;I[e+1|0]=98;I[e+2|0]=115;I[e+3|0]=0;Ia:{if((c|0)==29554){a=K[25977];K[b+304>>2]=K[25976];K[b+308>>2]=a;a=K[25979];K[b+312>>2]=K[25978];K[b+316>>2]=a;break Ia}a=K[26093];K[b+304>>2]=K[26092];K[b+308>>2]=a;a=K[26095];K[b+312>>2]=K[26094];K[b+316>>2]=a}K[b+328>>2]=3;K[b+296>>2]=336859409;K[b+300>>2]=353768980;J[b+168>>1]=261;K[b+8>>2]=0;K[b+12>>2]=16;K[b+144>>2]=1;K[b+184>>2]=1056;K[b+104>>2]=33572172;K[b+108>>2]=330;K[b+36>>2]=3;I[b+465|0]=L[b+465|0]&64|129;I[b+458|0]=L[b+458|0]&64|129;break a}K[b+104>>2]=17990912;K[b+8>>2]=3;K[b+12>>2]=36;c=26740;break a}K[b+328>>2]=3;K[b+296>>2]=320016657;K[b+300>>2]=353768980;K[b+124>>2]=32;K[b+128>>2]=44;K[b+104>>2]=186758144;K[b+12>>2]=1081398;K[b+16>>2]=2;K[b+4>>2]=32;K[b+8>>2]=0;K[b+116>>2]=899;K[b+120>>2]=1;I[b+169|0]=1;K[b+76>>2]=2;a=K[25981];K[b+304>>2]=K[25980];K[b+308>>2]=a;a=K[25983];K[b+312>>2]=K[25982];K[b+316>>2]=a;I[b+465|0]=L[b+465|0]&64|129;yd(b,3);c=26741;break a}K[b+600>>2]=1328;K[b+8>>2]=3;a=K[25985];K[b+304>>2]=K[25984];K[b+308>>2]=a;a=K[25987];K[b+312>>2]=K[25986];K[b+316>>2]=a;e=Ea(b+344|0,0,256);I[b+429|0]=129;I[b+416|0]=129;I[b+403|0]=129;I[b+399|0]=129;I[b+400|0]=129;I[b+397|0]=129;I[b+393|0]=129;d=103952;f=50;g=50;while(1){a=e+g|0;I[a|0]=L[a|0]|2;a=e+L[d+1|0]|0;I[a|0]=L[a|0]|2;a=e+L[d+2|0]|0;I[a|0]=L[a|0]|2;d=d+3|0;g=L[d|0];a=103952;if((d|0)!=103982){continue}break}d=b+344|0;while(1){e=d+f|0;I[e|0]=L[e|0]|4;e=d+L[a+1|0]|0;I[e|0]=L[e|0]|4;e=d+L[a+2|0]|0;I[e|0]=L[e|0]|4;a=a+3|0;f=L[a|0];if((a|0)!=103982){continue}break}I[b+168|0]=6;K[b+104>>2]=5128;I[b+413|0]=L[b+413|0]|4;break a}K[b+328>>2]=4;K[b+296>>2]=336858640;K[b+300>>2]=353768980;K[b+104>>2]=16782440;K[b+20>>2]=2;K[b+12>>2]=22;K[b+4>>2]=2;K[b+8>>2]=2;K[b+332>>2]=104e3;a=K[25997];K[b+304>>2]=K[25996];K[b+308>>2]=a;a=K[25999];K[b+312>>2]=K[25998];K[b+316>>2]=a;c=26991;break a}K[b+296>>2]=303174160;K[b+300>>2]=353768980;K[b+104>>2]=16781320;K[b+144>>2]=2;K[b+8>>2]=2;K[b+12>>2]=22;a=K[26005];K[b+304>>2]=K[26004];K[b+308>>2]=a;a=K[26007];K[b+312>>2]=K[26006];K[b+316>>2]=a;break a}K[b+8>>2]=0;K[b+12>>2]=16;K[b+56>>2]=2;K[b+28>>2]=17;a=K[26009];K[b+304>>2]=K[26008];K[b+308>>2]=a;a=K[26011];K[b+312>>2]=K[26010];K[b+316>>2]=a;a=0;d=b+344|0;while(1){e=a+d|0;I[e|0]=L[e|0]&231;e=d+(a|1)|0;I[e|0]=L[e|0]&231;e=d+(a|2)|0;I[e|0]=L[e|0]&231;e=d+(a|3)|0;I[e|0]=L[e|0]&231;a=a+4|0;if((a|0)!=256){continue}break}K[b+104>>2]=2280;K[b+108>>2]=2;K[b+608>>2]=104048;I[b+451|0]=L[b+451|0]|16;I[b+456|0]=L[b+456|0]|16;I[b+459|0]=L[b+459|0]|16;I[b+460|0]=L[b+460|0]|16;I[b+450|0]=L[b+450|0]|8;I[b+462|0]=L[b+462|0]|8;I[b+458|0]=L[b+458|0]|8;I[b+465|0]=L[b+465|0]&64|129;break a}K[b+296>>2]=269618961;K[b+300>>2]=370546196;K[b+12>>2]=131110;K[b+144>>2]=2;K[b+104>>2]=184559112;K[b+108>>2]=8192;K[b+16>>2]=0;K[b+20>>2]=2;K[b+4>>2]=1;K[b+8>>2]=2;K[b+100>>2]=K[b+96>>2];K[b+140>>2]=103676;K[b+68>>2]=2;K[b+56>>2]=1;K[b+44>>2]=130;K[b+28>>2]=2;a=K[26025];K[b+304>>2]=K[26024];K[b+308>>2]=a;a=K[26027];K[b+312>>2]=K[26026];K[b+316>>2]=a;I[b+465|0]=L[b+465|0]&64|129;c=26996;break a}K[b+4>>2]=524;K[b+8>>2]=2;K[b+196>>2]=368;K[b+104>>2]=0;K[b+336>>2]=104128;K[b- -64>>2]=1;a=K[26029];K[b+304>>2]=K[26028];K[b+308>>2]=a;a=K[26031];K[b+312>>2]=K[26030];K[b+316>>2]=a;I[b+465|0]=L[b+465|0]&64|129;c=6972015;break a}K[b+296>>2]=303174162;K[b+300>>2]=370545684;a=K[25873];K[b+304>>2]=K[25872];K[b+308>>2]=a;a=K[25875];K[b+312>>2]=K[25874];K[b+316>>2]=a;e=Ea(b+344|0,0,256);I[b+431|0]=1;I[b+429|0]=1;I[b+411|0]=1;I[b+405|0]=1;I[b+400|0]=1;I[b+396|0]=1;I[b+392|0]=1;a=104160;d=49;while(1){d=d+e|0;I[d|0]=L[d|0]|4;d=e+L[a+1|0]|0;I[d|0]=L[d|0]|4;d=e+L[a+2|0]|0;I[d|0]=L[d|0]|4;a=a+3|0;d=L[a|0];if((a|0)!=104193){continue}break}K[b+600>>2]=4256;K[b+8>>2]=0;K[b+12>>2]=16;I[b+168|0]=7;K[b+132>>2]=32;I[b+392|0]=L[b+392|0]|128;I[b+396|0]=L[b+396|0]|128;I[b+400|0]=L[b+400|0]|128;I[b+405|0]=L[b+405|0]|128;I[b+411|0]=L[b+411|0]|128;I[b+429|0]=L[b+429|0]|128;I[b+431|0]=L[b+431|0]|128;K[b+188>>2]=1056;K[b+192>>2]=29301;K[b+104>>2]=19964960;break a}K[b+600>>2]=1056;e=Ea(b+344|0,0,256);I[b+393|0]=1;I[b+365|0]=1;I[b+360|0]=1;I[b+545|0]=1;I[b+529|0]=1;I[b+391|0]=1;I[b+389|0]=1;I[b+390|0]=1;I[b+387|0]=1;I[b+379|0]=1;I[b+374|0]=1;I[b+368|0]=1;I[b+489|0]=1;I[b+487|0]=1;I[b+398|0]=1;a=104224;d=17;while(1){d=d+e|0;I[d|0]=L[d|0]|4;d=e+L[a+1|0]|0;I[d|0]=L[d|0]|4;d=e+L[a+2|0]|0;I[d|0]=L[d|0]|4;a=a+3|0;d=L[a|0];if((a|0)!=104251){continue}break}I[b+360|0]=L[b+360|0]|128;I[b+365|0]=L[b+365|0]|128;I[b+393|0]=L[b+393|0]|128;I[b+368|0]=L[b+368|0]|128;I[b+374|0]=L[b+374|0]|128;I[b+379|0]=L[b+379|0]|128;I[b+387|0]=L[b+387|0]|128;I[b+389|0]=L[b+389|0]|128;I[b+390|0]=L[b+390|0]|128;I[b+391|0]=L[b+391|0]|128;I[b+529|0]=L[b+529|0]|128;I[b+545|0]=L[b+545|0]|128;I[b+489|0]=L[b+489|0]|128;I[b+487|0]=L[b+487|0]|128;I[b+398|0]=L[b+398|0]|128;a=K[26055];K[b+312>>2]=K[26054];K[b+316>>2]=a;a=K[26053];K[b+304>>2]=K[26052];K[b+308>>2]=a;K[b+296>>2]=353636370;K[b+300>>2]=336925972;K[b+200>>2]=0;K[b+8>>2]=7;K[b+12>>2]=2097184;I[b+168|0]=2;K[b+104>>2]=50176;K[b+84>>2]=1;yd(b,3);break a}K[b+296>>2]=320017171;K[b+300>>2]=320017171;K[b+104>>2]=184618072;K[b+8>>2]=12;K[b+12>>2]=32;a=K[25861];K[b+304>>2]=K[25860];K[b+308>>2]=a;a=K[25863];K[b+312>>2]=K[25862];K[b+316>>2]=a;c=27500;break a}K[b+184>>2]=42752;K[b+600>>2]=4352;Ea(b+344|0,0,256);I[b+456|0]=1;I[b+457|0]=1;I[b+458|0]=1;I[b+459|0]=1;I[b+449|0]=1;I[b+450|0]=1;I[b+451|0]=1;I[b+452|0]=1;I[b+453|0]=1;I[b+454|0]=1;I[b+455|0]=1;I[b+456|0]=1;I[b+441|0]=1;I[b+442|0]=1;I[b+443|0]=1;I[b+444|0]=1;I[b+445|0]=1;I[b+446|0]=1;I[b+447|0]=1;I[b+448|0]=1;I[b+460|0]=65;I[b+461|0]=65;I[b+532|0]=32;I[b+527|0]=32;I[b+519|0]=32;I[b+515|0]=32;I[b+349|0]=32;I[b+350|0]=32;I[b+346|0]=32;K[b+132>>2]=20;K[b+112>>2]=286331152;K[b+104>>2]=1024;K[b+108>>2]=16384;K[b+40>>2]=1;K[b+8>>2]=8;I[b+458|0]=65;I[b+453|0]=65;I[b+447|0]=65;I[b+448|0]=65;I[b+443|0]=65;I[b+444|0]=65;c=27503;break a}K[b+328>>2]=10;K[b+296>>2]=336859666;K[b+300>>2]=353768980;I[b+168|0]=2;K[b+104>>2]=263264;K[b+8>>2]=7;a=K[26065];K[b+304>>2]=K[26064];K[b+308>>2]=a;a=K[26067];K[b+312>>2]=K[26066];K[b+316>>2]=a;c=27509;break a}K[b+104>>2]=1;c=27513;break a}K[b+116>>2]=5e3;K[b+104>>2]=16777216;K[b+24>>2]=1;K[b+16>>2]=0;K[b+20>>2]=2;K[b+8>>2]=2;K[b+12>>2]=32;K[b+328>>2]=5;c=27745;break a}K[b+116>>2]=5e3;K[b+104>>2]=99336;K[b+108>>2]=256;K[b+24>>2]=1;K[b+16>>2]=0;K[b+20>>2]=2;K[b+8>>2]=2;K[b+12>>2]=32;K[b+328>>2]=5;c=27764;break a}K[b+328>>2]=6;K[b+296>>2]=336859409;K[b+300>>2]=353768980;K[b+600>>2]=1056;K[b+104>>2]=2114600;K[b+108>>2]=138;K[b+8>>2]=4;K[b+632>>2]=104288;K[b+604>>2]=104288;a=K[26093];K[b+304>>2]=K[26092];K[b+308>>2]=a;a=K[26095];K[b+312>>2]=K[26094];K[b+316>>2]=a;c=28011;break a}K[b+328>>2]=4;K[b+104>>2]=1;K[b+8>>2]=2;K[b+36>>2]=256;c=28020;break a}K[b+4>>2]=48;K[b+8>>2]=0;K[b+12>>2]=128;K[b+104>>2]=2169880;K[b+32>>2]=1;K[b+36>>2]=256;K[b+24>>2]=1;K[b+136>>2]=85767;a=K[26097];K[b+304>>2]=K[26096];K[b+308>>2]=a;a=K[26099];K[b+312>>2]=K[26098];K[b+316>>2]=a;I[b+465|0]=L[b+465|0]&64|129;c=28268;break a}K[b+8>>2]=0;K[b+104>>2]=71752;a=K[26101];K[b+304>>2]=K[26100];K[b+308>>2]=a;a=K[26103];K[b+312>>2]=K[26102];K[b+316>>2]=a;I[b+465|0]=L[b+465|0]&64|129;c=28258;break a}K[b+296>>2]=336858898;K[b+300>>2]=370546196;K[b+104>>2]=1088;K[b+108>>2]=512;K[b+8>>2]=2;K[b+12>>2]=524310;a=K[26105];K[b+304>>2]=K[26104];K[b+308>>2]=a;a=K[26107];K[b+312>>2]=K[26106];K[b+316>>2]=a;c=28525;break a}K[b+328>>2]=3;K[b+296>>2]=320015633;K[b+300>>2]=353768980;I[b+168|0]=7;K[b+8>>2]=2;K[b+12>>2]=6;K[b+104>>2]=20488;K[b+108>>2]=192;K[b+36>>2]=9;K[b+60>>2]=260;a=K[26109];K[b+304>>2]=K[26108];K[b+308>>2]=a;a=K[26111];K[b+312>>2]=K[26110];K[b+316>>2]=a;I[b+465|0]=L[b+465|0]&64|129;c=28780;break a}K[b+296>>2]=353569552;K[b+300>>2]=353768980;K[b+116>>2]=5e3;K[b+104>>2]=33570920;K[b+108>>2]=14336;K[b+8>>2]=3;K[b+12>>2]=139286;K[b+100>>2]=K[b+96>>2];a=K[26113];K[b+304>>2]=K[26112];K[b+308>>2]=a;a=K[26115];K[b+312>>2]=K[26114];K[b+316>>2]=a;I[b+465|0]=L[b+465|0]&64|129;a=0;d=b+344|0;while(1){e=a+d|0;I[e|0]=L[e|0]&253;e=d+(a|1)|0;I[e|0]=L[e|0]&253;e=d+(a|2)|0;I[e|0]=L[e|0]&253;e=d+(a|3)|0;I[e|0]=L[e|0]&253;a=a+4|0;if((a|0)!=256){continue}break}I[b+442|0]=L[b+442|0]|2;I[b+443|0]=L[b+443|0]|2;I[b+444|0]=L[b+444|0]|2;I[b+446|0]=L[b+446|0]|2;I[b+447|0]=L[b+447|0]|2;I[b+450|0]=L[b+450|0]|2;I[b+451|0]=L[b+451|0]|2;I[b+453|0]=L[b+453|0]|2;I[b+454|0]=L[b+454|0]|2;I[b+456|0]=L[b+456|0]|2;I[b+457|0]=L[b+457|0]|2;I[b+459|0]=L[b+459|0]|2;I[b+460|0]=L[b+460|0]|2;I[b+462|0]=L[b+462|0]|2;I[b+464|0]=L[b+464|0]|2;I[b+466|0]=L[b+466|0]|2;K[b+144>>2]=2;K[b+68>>2]=2;break a}K[b+296>>2]=303172879;K[b+300>>2]=353768980;K[b+328>>2]=3;K[b+8>>2]=3;K[b+12>>2]=262;K[b+104>>2]=16805928;K[b+108>>2]=30;a=K[26117];K[b+304>>2]=K[26116];K[b+308>>2]=a;a=K[26119];K[b+312>>2]=K[26118];K[b+316>>2]=a;c=29295;break a}Pe(b);c=29301;break a}K[b+328>>2]=3;K[b+296>>2]=336859153;K[b+300>>2]=353768980;J[b+168>>1]=261;K[b+8>>2]=0;K[b+12>>2]=22;K[b+124>>2]=0;K[b+128>>2]=44;K[b+104>>2]=16794624;K[b+108>>2]=128;K[b+36>>2]=3;K[b+60>>2]=4;a=K[25869];K[b+304>>2]=K[25868];K[b+308>>2]=a;a=K[25871];K[b+312>>2]=K[25870];K[b+316>>2]=a;if((c|0)==25459){K[b+108>>2]=136}I[b+465|0]=L[b+465|0]&64|129;I[b+458|0]=L[b+458|0]&64|129;a=0;d=b+344|0;while(1){e=a+d|0;I[e|0]=L[e|0]&223;e=d+(a|1)|0;I[e|0]=L[e|0]&223;e=d+(a|2)|0;I[e|0]=L[e|0]&223;e=d+(a|3)|0;I[e|0]=L[e|0]&223;a=a+4|0;if((a|0)!=256){continue}break}I[b+442|0]=L[b+442|0]|32;I[b+444|0]=L[b+444|0]|32;I[b+447|0]=L[b+447|0]|32;I[b+450|0]=L[b+450|0]|32;I[b+452|0]=L[b+452|0]|32;I[b+453|0]=L[b+453|0]|32;I[b+454|0]=L[b+454|0]|32;I[b+458|0]=L[b+458|0]|32;I[b+462|0]=L[b+462|0]|32;I[b+463|0]=L[b+463|0]|32;I[b+466|0]=L[b+466|0]|32;I[b+441|0]=L[b+441|0]|32;I[b+445|0]=L[b+445|0]|32;I[b+449|0]=L[b+449|0]|32;I[b+455|0]=L[b+455|0]|32;I[b+461|0]=L[b+461|0]|32;I[b+465|0]=L[b+465|0]|32;break a}K[b+296>>2]=303174162;K[b+300>>2]=370545684;K[b+600>>2]=3456;I[b+169|0]=1;K[b+8>>2]=0;K[b+12>>2]=22;K[b+100>>2]=K[b+96>>2];a=K[25873];K[b+304>>2]=K[25872];K[b+308>>2]=a;a=K[25875];K[b+312>>2]=K[25874];K[b+316>>2]=a;Ea(b+344|0,0,256);I[b+365|0]=1;I[b+366|0]=1;I[b+357|0]=1;I[b+358|0]=1;I[b+359|0]=1;I[b+360|0]=1;I[b+361|0]=1;I[b+362|0]=1;I[b+363|0]=1;I[b+364|0]=1;I[b+349|0]=1;I[b+350|0]=1;I[b+351|0]=1;I[b+352|0]=1;I[b+353|0]=1;I[b+354|0]=1;I[b+355|0]=1;I[b+356|0]=1;a=74;d=74;while(1){e=b+d|0;I[e+344|0]=L[e+344|0]|1;I[e+345|0]=L[e+345|0]|1;I[e+346|0]=L[e+346|0]|1;d=d+3|0;if((d|0)!=116){continue}break}while(1){d=a+b|0;I[d+344|0]=L[d+344|0]|2;I[d+345|0]=L[d+345|0]|2;I[d+346|0]=L[d+346|0]|2;a=a+3|0;if((a|0)!=116){continue}break}d=26;while(1){a=b+d|0;I[a+344|0]=L[a+344|0]|4;I[a+345|0]=L[a+345|0]|4;I[a+346|0]=L[a+346|0]|4;I[a+347|0]=L[a+347|0]|4;I[a+348|0]=L[a+348|0]|4;d=d+5|0;if((d|0)!=71){continue}break}K[b+112>>2]=84648;K[b+104>>2]=270589952;K[b+108>>2]=65536;K[b+40>>2]=1;K[b+204>>2]=K[b+600>>2]+74;break a}K[b+8>>2]=2;K[b+12>>2]=32;K[b+328>>2]=3;K[b+124>>2]=32;K[b+104>>2]=16864280;K[b+108>>2]=256;K[b+68>>2]=2;K[b+36>>2]=259;K[b+40>>2]=118;K[b+28>>2]=1;I[b+458|0]=L[b+458|0]|128;c=29548;break a}K[b+296>>2]=370544658;K[b+300>>2]=370546196;K[b+164>>2]=130;K[b+8>>2]=0;K[b+12>>2]=86;K[b+104>>2]=87064;I[b+169|0]=1;K[b+152>>2]=3;a=K[26121];K[b+304>>2]=K[26120];K[b+308>>2]=a;a=K[26123];K[b+312>>2]=K[26122];K[b+316>>2]=a;I[b+465|0]=L[b+465|0]&64|129;c=7564650;break a}K[b+296>>2]=269487120;K[b+300>>2]=320148500;K[b+8>>2]=3;K[b+12>>2]=278;K[b+144>>2]=2;K[b+104>>2]=32872;a=K[26125];K[b+304>>2]=K[26124];K[b+308>>2]=a;a=K[26127];K[b+312>>2]=K[26126];K[b+316>>2]=a;I[b+465|0]=L[b+465|0]&64|129;c=29553;break a}K[b+296>>2]=336859152;K[b+300>>2]=353768980;K[b+8>>2]=0;K[b+144>>2]=1;K[b+104>>2]=6408;a=K[26129];K[b+304>>2]=K[26128];K[b+308>>2]=a;a=K[26131];K[b+312>>2]=K[26130];K[b+316>>2]=a;I[b+465|0]=L[b+465|0]&64|129;c=29558;break a}K[b+296>>2]=320015376;K[b+300>>2]=353768980;I[b+168|0]=4;K[b+12>>2]=22;K[b+4>>2]=1;K[b+8>>2]=2;K[b+104>>2]=1248;K[b+100>>2]=K[b+96>>2];a=K[26133];K[b+304>>2]=K[26132];K[b+308>>2]=a;a=K[26135];K[b+312>>2]=K[26134];K[b+316>>2]=a;break a}K[b+296>>2]=303174162;K[b+300>>2]=370545684;I[b+169|0]=1;K[b+8>>2]=0;K[b+12>>2]=22;K[b+112>>2]=5288;K[b+100>>2]=K[b+96>>2];a=K[25877];K[b+304>>2]=K[25876];K[b+308>>2]=a;a=K[25879];K[b+312>>2]=K[25878];K[b+316>>2]=a;Ja:{switch(c-29793|0){default:if((c|0)!=27502){if((c|0)!=28012){break c}a=K[26137];K[b+304>>2]=K[26136];K[b+308>>2]=a;a=K[26139];K[b+312>>2]=K[26138];K[b+316>>2]=a;K[b+600>>2]=3328;K[b+296>>2]=320017171;K[b+300>>2]=320017171;K[b+104>>2]=2098176;K[b+108>>2]=131072;K[b+8>>2]=13;break c}K[b+104>>2]=1;K[b+600>>2]=3200;break c;case 4:break Ja;case 1:case 2:case 3:break c;case 0:break d}}K[b+104>>2]=1;K[b+108>>2]=524288;K[b+600>>2]=3072;break c}K[b+328>>2]=10;K[b+296>>2]=353636370;K[b+300>>2]=336925972;I[b+173|0]=1;K[b+8>>2]=7;K[b+12>>2]=32;I[b+168|0]=2;K[b+84>>2]=1;a=K[26141];K[b+304>>2]=K[26140];K[b+308>>2]=a;K[b+104>>2]=(c|0)==24954?2118920:2114824;a=K[26143];K[b+312>>2]=K[26142];K[b+316>>2]=a;break a}md(b);K[b+296>>2]=303173650;K[b+300>>2]=303174162;K[b+104>>2]=2131208;K[b+8>>2]=3;K[b+12>>2]=32;a=K[25865];K[b+304>>2]=K[25864];K[b+308>>2]=a;a=K[25867];K[b+312>>2]=K[25866];K[b+316>>2]=a;c=29812;break a}Pe(b);c=30059;break a}K[b+112>>2]=21160;K[b+104>>2]=16;K[b+600>>2]=1536;K[b+40>>2]=1;break a}K[b+296>>2]=269488144;K[b+300>>2]=370546198;K[b+8>>2]=0;K[b>>2]=33;K[b+148>>2]=1;K[b+104>>2]=12615688;K[b+16>>2]=2;K[b+100>>2]=K[b+96>>2];K[b+632>>2]=104592;K[b+604>>2]=104592;a=K[26145];K[b+304>>2]=K[26144];K[b+308>>2]=a;a=K[26147];K[b+312>>2]=K[26146];K[b+316>>2]=a;c=30313;break a}K[b+296>>2]=370544662;K[b+300>>2]=370546198;K[b+8>>2]=3;K[b+12>>2]=2;K[b+148>>2]=1;K[b+184>>2]=12544;J[b+170>>1]=257;K[b+176>>2]=1;I[b+172|0]=1;K[b>>2]=33;K[b+4>>2]=0;K[b+100>>2]=K[b+96>>2];a=K[26225];K[b+304>>2]=K[26224];K[b+308>>2]=a;a=K[26227];K[b+312>>2]=K[26226];K[b+316>>2]=a;if((c|0)!=7959909){break a}K[b+112>>2]=24;K[b+104>>2]=1;K[b+108>>2]=1048576;c=7959909;break a}a=K[25873];K[b+304>>2]=K[25872];K[b+308>>2]=a;a=K[25875];K[b+312>>2]=K[25874];K[b+316>>2]=a;K[b+600>>2]=2944;K[b+104>>2]=2097152;K[b+108>>2]=262144;K[b+48>>2]=1}Yb(b);I[b+422|0]=L[b+422|0]|2;break a}K[b+40>>2]=1}K[b+212>>2]=c;a=K[b+104>>2];if(a&8){K[b+124>>2]=46;K[b+128>>2]=44}if(a&4){K[b+124>>2]=0}return b}function Jd(a){var b=0,c=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0;a:{c=K[32538];K[47354]=0;K[47568]=0;K[49828]=0;K[47569]=0;I[199328]=0;K[49827]=0;K[49845]=0;I[190280]=0;I[190268]=1;K[47202]=0;K[49573]=0;K[49846]=0;I[199304]=0;I[199388]=0;K[33691]=0;K[33285]=0;K[33708]=1;K[33709]=1;K[33288]=0;b=K[33730];K[33712]=K[33729];K[33713]=b;b=K[33732];K[33714]=K[33731];K[33715]=b;b=K[33734];K[33716]=K[33733];K[33717]=b;b=K[33736];K[33718]=K[33735];K[33719]=b;b=K[33738];K[33720]=K[33737];K[33721]=b;b=K[33740];K[33722]=K[33739];K[33723]=b;b=K[33742];K[33724]=K[33741];K[33725]=b;K[33726]=K[33743];I[134784]=0;I[134824]=0;I[134772]=0;I[134760]=0;K[33284]=-1;K[33692]=0;K[32525]=0;K[47201]=K[33717];K[47200]=K[33718];af();K[34438]=0;K[34437]=0;b=K[33730];K[34048]=K[33729];K[34049]=b;b=K[33732];K[34050]=K[33731];K[34051]=b;b=K[33734];K[34052]=K[33733];K[34053]=b;b=K[33736];K[34054]=K[33735];K[34055]=b;b=K[33738];K[34056]=K[33737];K[34057]=b;b=K[33740];K[34058]=K[33739];K[34059]=b;b=K[33742];K[34060]=K[33741];K[34061]=b;K[34062]=K[33743];b:{c:{if(c&1){K[K[32539]>>2]=0;if(K[47569]|(K[49845]|K[49827])){break c}break b}K[K[32539]>>2]=0;if(K[49845]|K[49827]){break c}if(!K[47569]){break b}}I[190280]=1}K[49828]=0;b=268436735;d:{if(!K[34391]|!K[34388]){break d}K[47204]=0;K[47203]=0;K[47199]=0;K[34439]=0;if(!K[47192]){b=Le(86228);if(b){break d}}b=K[33283];if(!b){b=Qa(16);if(b){K[b>>2]=0;K[b+4>>2]=0;K[b+8>>2]=0;K[b+12>>2]=0}K[33283]=b}f=268439807;c=K[K[47192]+328>>2];if(c>>>0>20|!K[(c<<3)+129104>>2]){b=f}else{e:{if(!a){f=2;e=0;break e}f=4;e=Ba(a)+1|0}K[b+8>>2]=f;K[b>>2]=a;K[b+12>>2]=K[(c<<3)+129108>>2];K[b+4>>2]=a?a+e|0:0;b=0}if(b){break d}sd(0);f:{while(1){K[34436]=0;a=K[34391];K[51290]=a;K[54046]=a+K[34390];if(K[50767]<=102399){K[50767]=102400}g=K[51290];g:{if(g>>>0>=N[54046]){break g}while(1){e=K[50757];h=K[50758];a=e-h|0;if((((a|0)<=0?a+170|0:a)-171|0)>=-1){a=K[54731];if((a|0)<=0){break g}f=0;K[50763]=0;K[50762]=0;K[50765]=2147483647;a=L[218920]?K[54732]:a;h:{while(1){c=a-1|0;K[54732]=c;if((a|0)<=0){break h}K[51290]=g+1;a=K[51293];b=a+1|0;K[51293]=(b|0)<=5499?b:0;a=Q(K[50755],J[(a<<1)+205184>>1]);b=a>>8;I[g|0]=b;e=K[51290];K[51290]=e+1;I[e|0]=a>>>16;e=K[50756];i:{if(!e){a=c;break i}a=c;c=K[e+4>>2];if(!c){break i}wa[c|0](b<<16>>16);a=K[54732]}c=K[51292];e=c+1|0;K[51292]=e;J[(c<<1)+205184>>1]=b;if((e|0)>=5500){K[51292]=0}g=K[51290];if(N[54046]>=g+2>>>0){continue}break}f=1}I[218920]=f;break g}c=(e<<4)+216192|0;a=K[c+4>>2];j:{k:{l:{m:{n:{o:{p:{q:{r:{s:{t:{u:{v:{w:{x:{y:{b=K[c>>2];switch((b&255)-1|0){case 9:break l;case 7:break m;case 10:break n;case 11:break o;case 13:break p;case 0:break q;case 1:break r;case 2:break s;case 3:break t;case 6:break u;case 5:break v;case 4:break w;case 15:break x;case 8:break y;default:break k}}if(!K[50759]){break k}b=K[c+12>>2];c=K[c+8>>2];K[50768]=0;g=c?c:99232;K[50766]=g;K[50769]=a?2097152/(a|0)|0:0;a=K[50971];e=(Q(a,K[50788])|0)/50|0;c=Q(e-a|0,-18);a=K[50785];a=((a|0)>=101?101:a)-K[50790]|0;f=c+((Q(K[50970],L[((a|0)>0?a:0)+105680|0])|0)/128|0)|0;a=b>>16;c=b&65535;b=f+((Q(e,(a|0)<(c|0)?a:c)|0)/2|0)|0;K[50770]=b;a=(f+((Q(e,(a|0)>(c|0)?a:c)|0)/2|0)|0)-b|0;K[50771]=a;c=L[g|0];K[33072]=K[50976];K[50767]=b+(Q(a,c)>>8);break k}wa[K[K[50756]>>2]](a,K[c+8>>2]);Ha(a);break k}if(!L[218920]){K[54731]=K[54731]-a}K[50781]=100;K[50773]=0;Ie();K[50763]=0;K[50762]=0;K[50765]=2147483647;if(!a){break k}a=L[218920]?K[54732]:a;while(1){c=a-1|0;K[54732]=c;if((a|0)<=0){break k}a=K[51290];K[51290]=a+1;b=K[51293];e=b+1|0;K[51293]=(e|0)<=5499?e:0;e=a;a=Q(K[50755],J[(b<<1)+205184>>1]);b=a>>8;I[e|0]=b;e=K[51290];K[51290]=e+1;I[e|0]=a>>>16;e=K[50756];z:{if(!e){a=c;break z}a=c;c=K[e+4>>2];if(!c){break z}wa[c|0](b<<16>>16);a=K[54732]}c=K[51292];e=c+1|0;K[51292]=e;J[(c<<1)+205184>>1]=b;if((e|0)>=5500){K[51292]=0}e=1;if(N[54046]>=K[51290]+2>>>0){continue}break}break j}K[50773]=0;K[54731]=K[54729];Ie();b=K[c+12>>2];e=K[c+8>>2];A:{if(L[218920]){a=K[54733];break A}K[54734]=0}h=b>>8;f=b&255;K[50762]=0;K[50763]=0;while(1){c=a-1|0;K[54733]=c;if((a|0)<=0){break k}a=K[54734];b=a+1|0;B:{if(!f){g=L[a+e|0]|I[b+e|0]<<8;b=a+2|0;break B}g=Q(f,I[a+e|0])}K[54734]=b;a=K[51293];i=a+1|0;K[51293]=i;a=((Q(h,Q(K[33037],Q(K[33038],g))>>10)|0)/32|0)+(Q(K[50755],J[(a<<1)+205184>>1])>>8)|0;a=(a|0)<=-32768?-32768:a;b=(a|0)>=32767?32767:a;if((i|0)>=5500){K[51293]=0}I[K[51290]]=b;I[K[51290]+1|0]=b>>>8;g=K[50756];C:{if(!g){a=c;break C}a=c;c=K[g+12>>2];if(!c){break C}wa[c|0](b<<16>>16);a=K[54733]}c=K[51290];K[51290]=c+2;g=K[51292];i=g+1|0;K[51292]=i;J[(g<<1)+205184>>1]=(Q(b,3)|0)/4;if((i|0)>=5500){K[51292]=0}if(N[54046]>=c+4>>>0){continue}break}e=1;break j}b=K[c+12>>2];e=a>>>16|0;K[50777]=e;a=a&65535;K[50773]=a;f=b&255;K[50774]=f;K[50775]=b>>8;if(!f){K[50777]=e<<1;K[50773]=a<<1}K[50778]=0;K[50776]=0;K[50772]=K[c+8>>2];break k}K[50773]=0}K[54731]=K[54729];b=K[50759];D:{if(!L[218920]){if(!b){break k}f=K[c+12>>2];g=K[c+8>>2];c=a>>16;K[55912]=c&255;I[218960]=1;K[55908]=0;if(a&67108864){K[55908]=3;K[55909]=K[(c>>>6&12)+110496>>2]}if(a&134217728){K[55908]=4;K[55909]=K[(c>>>6&12)+110512>>2]}a=a&65504;while(1){E:{c=e+1|0;e=(c|0)<=169?c:0;if((h|0)==(e|0)){break E}c=K[(e<<4)+216192>>2];if((c|0)==3){I[218960]=0;break E}if(c-5>>>0>1){continue}}break}K[55913]=K[50762];a=a+32&131008;a=a?a:64;K[50763]=a+K[50763];K[55684]=Q(J[101997],7800)+(M[102024]<<8)<<8;K[55704]=Q(J[101998],9e3)+(M[102025]<<8)<<8;n=K[50980];d=+(a|0);l=+(a>>>2|0);a=0;while(1){if((a|0)!=7){c=a<<1;i=c+b|0;e=J[i+218>>1]<<8;h=Q(a,80)+222176|0;i=J[i+164>>1];m=e+Q(i,J[(c+g|0)+2>>1])<<8;K[h>>2]=m;k=+(m|0);P[h+16>>3]=k;P[h+48>>3]=(+(e+Q(i,J[(c+f|0)+2>>1])<<8)-k)*16/l}c=Q(a,80);e=c+222176|0;m=b+(a<<1)|0;i=J[m+182>>1];h=a+g|0;p=Q(i,L[h+18|0])<<6;K[e+4>>2]=p;k=+(p|0);P[e+24>>3]=k;o=e;e=a+f|0;P[o+56>>3]=(+(Q(i,L[e+18|0])<<6)-k)*64/d;F:{if((a|0)>(n|0)|a>>>0>5){break F}i=c+222176|0;p=J[m+200>>1];m=Q(p,L[h+26|0])<<10;K[i+8>>2]=m;k=+(m|0);P[i+32>>3]=k;o=i- -64|0;i=p<<10;P[o>>3]=(+(Q(i,L[e+26|0])|0)-k)*64/d;if(a>>>0<=2){c=c+222176|0;h=Q(i,L[h+32|0]);K[c+12>>2]=h;k=+(h|0);P[c+40>>3]=k;P[c+72>>3]=(+(Q(i,L[e+32|0])|0)-k)*64/d;break F}K[c+222188>>2]=m}a=a+1|0;if((a|0)!=8){continue}break}break D}if(!b){break k}}while(1){a=K[50762];if(!L[218960]&(a|0)==K[50763]){break k}G:{H:{I:{J:{if(!(a&63)){if(!a){K[50826]=218976;K[54742]=0;K[54736]=Ke(K[50767]<<4,218976,0);b=K[50767];K[54737]=890/(b>>12);K[54739]=(Q(K[50781],Q(K[50779],b>>8))|0)/8e4;break H}if(!K[50759]){b=K[50767];break H}c=K[50768]+K[50769]|0;K[50768]=c;b=K[50766];if(b){c=c>>8;c=Q(L[b+((c|0)>=127?127:c)|0],K[50771])>>8}else{c=0}K[55911]=K[55911]+K[55915];b=K[55914];b=(b|0)<=23551?b:0;K[55914]=b+K[50761];b=(c+K[50770]|0)+Q(K[33072],L[(b>>6)+110528|0]-128|0)|0;K[50767]=b;e=K[51291];c=e?e<<12:b;if(!(!e&(c|0)>102399)){b=(c|0)<=102400?102400:c;K[50767]=b}if((a|0)==K[55913]){break H}a=0;h=K[50980];if((h|0)<0){break I}while(1){g=Q(a,80);c=g+222176|0;d=P[c+48>>3]+P[c+16>>3];P[c+16>>3]=d;l=P[c+56>>3]+P[c+24>>3];P[c+24>>3]=l;k=P[c- -64>>3]+P[c+32>>3];P[c+32>>3]=k;if(S(d)<2147483648){e=~~d}else{e=-2147483648}K[c>>2]=e;if(S(k)<2147483648){e=~~k}else{e=-2147483648}K[c+8>>2]=e;if(S(l)<2147483648){f=~~l}else{f=-2147483648}K[c+4>>2]=(f|0)>0?f:0;K:{if((a|0)>2){break K}c=g+222176|0;d=P[c+72>>3]+P[c+40>>3];P[c+40>>3]=d;if(S(d)<2147483648){e=~~d;break K}e=-2147483648}K[g+222188>>2]=e;a=a+1|0;if((h|0)>=(a|0)){continue}break}break J}if(a&7){break G}c=K[54736];L:{if((c|0)<=0){break L}b=K[54735];if((b|0)<=0){break L}e=K[50826];a=1;while(1){f=a<<2;g=f+e|0;K[g>>2]=K[g>>2]+K[f+203312>>2];if(a>>>0>28|(a|0)>=(c|0)){break L}f=(a|0)<(b|0);a=a+1|0;if(f){continue}break}}a=K[33073];if((a|0)>255){break G}K[33073]=a+1;break G}if((a|0)>=8){break H}}while(1){if((a|0)!=7){c=Q(a,80)+222176|0;d=P[c+48>>3]+P[c+16>>3];P[c+16>>3]=d;if(S(d)<2147483648){e=~~d}else{e=-2147483648}K[c>>2]=e}c=Q(a,80)+222176|0;d=P[c+56>>3]+P[c+24>>3];P[c+24>>3]=d;if(S(d)<2147483648){e=~~d}else{e=-2147483648}K[c+4>>2]=(e|0)>0?e:0;a=a+1|0;if((a|0)!=8){continue}break}}K[55906]=b>>11;K[54735]=K[54736];K[55904]=Q(K[50760],b>>7);K[55905]=K[50754]/(b>>12);a=K[54742];c=a^1;K[54742]=c;K[50826]=Q(a,1600)+218976;K[54736]=Ke(b<<4,Q(c,1600)+218976|0,1);b=K[50759];if(!b|!K[51022]){break G}l=P[25430];k=P[25429];a=1;while(1){c=b+(a<<2)|0;if(K[c+272>>2]){e=K[c+308>>2];c=Q(a,40)+203456|0;j=hb(l*+J[(Q(a,80)+222176|0)+2>>1]);d=nb(k*+(e|0));j=j*d;j=j+j;P[c+8>>3]=j;d=d*-d;P[c+16>>3]=d;P[c>>3]=1-j-d}a=a+1|0;if((a|0)!=9){continue}break}}f=K[50762]+1|0;K[50762]=f;a=K[50765];g=a+K[55904]|0;K[50765]=g;M:{if(!((g|0)<0&(a|0)>0)){b=K[55907];break M}i=K[55905];b=K[50800]+((i|0)/-2|0)|0;K[55907]=b;m=K[50763];if((m|0)<(f|0)){break k}n=K[54738]+1|0;K[54738]=n;h=K[50767];c=K[50980];a=c+1|0;N:{if((a|0)>8){break N}e=h<<3;if(c&1){K[(a<<2)+203264>>2]=((K[Q(a,80)+222176>>2]/(e|0)|0)+1|0)/2;a=c+2|0}if((c|0)==7){break N}while(1){c=(a<<2)+203264|0;p=Q(a,80)+222176|0;K[c>>2]=((K[p>>2]/(e|0)|0)+1|0)/2;K[c+4>>2]=((K[p+80>>2]/(e|0)|0)+1|0)/2;a=a+2|0;if((a|0)!=9){continue}break}}a=(Q(K[50781],Q(K[50779],h>>8))|0)/8e4|0;K[54739]=a;c=K[55908];O:{if((c|0)<=0){break O}P:{switch(c-3|0){case 0:if((m-f|0)>=i<<1){break O}K[55908]=2;a=(Q(K[55909],a)|0)/256|0;K[54739]=a;break O;case 1:K[55908]=2;a=(Q(K[55909],a)|0)/256|0;K[54739]=a;break O;default:break P}}K[55908]=c-1}c=K[55910];if(c){e=a;a=K[55911]>>8;a=(Q(e,L[c+((a|0)>=127?127:a)|0])|0)/128|0;K[54739]=a}c=K[K[32972]+92>>2];if((c|0)>7){break M}e=L[K[55912]+((c<<3)+106336|0)|0];c=e&15;e=e>>>4|0;if(!e){break M}if((e|0)==15){K[55912]=0;K[54739]=(Q(a,c)|0)/16;break M}if((n|0)%(e|0)|0){break M}K[54739]=(Q(a,c)|0)/16}f=b+1|0;K[55907]=f;c=g>>>16|0;e=0;if(!((f|0)<0|(f|0)>=K[50799])){b=K[50980];a=b+1|0;Q:{if((a|0)>8){break Q}g=8-b|0;h=g&1;if((b|0)!=7){i=g&-2;b=0;while(1){g=a<<2;m=g+4|0;e=Q(K[m+203216>>2],J[(Q(c,K[m+203264>>2])>>>4&4094)+106400>>1])+(Q(K[g+203216>>2],J[(Q(c,K[g+203264>>2])>>>4&4094)+106400>>1])+e|0)|0;a=a+2|0;b=b+2|0;if((i|0)!=(b|0)){continue}break}}if(!h){break Q}a=a<<2;e=Q(K[a+203216>>2],J[(Q(c,K[a+203264>>2])>>>4&4094)+106400>>1])+e|0}e=Q(L[f+132160|0],(e|0)/K[55906]|0)}a=1;f=K[54737];R:{if((f|0)<=0){b=c;break R}g=K[50826];b=c;while(1){e=Q(K[g+(a<<2)>>2],J[((b&65504)>>>4|0)+106400>>1])+e|0;b=b+c|0;a=a+1|0;if((f|0)>=(a|0)){continue}break}}f=K[54735];if((f|0)>=(a|0)){g=K[50826];while(1){e=e-Q(K[g+(a<<2)>>2],J[((b&65504)>>>4|0)+106400>>1])|0;b=b+c|0;a=a+1|0;if((f|0)>=(a|0)){continue}break}}a=K[54728];f=(a|0)==64?e:Q(a,e>>6);if(K[51022]){S:{if(!K[50759]){g=0;break S}c=vg(K[33209],0,1103515245,0);a=va;c=c+12345|0;a=c>>>0<12345?a+1|0:a;a=xg(c,a);K[33209]=a;l=+((a&16383)- -8192|0);b=K[50759];g=0;a=1;while(1){e=K[(b+(a<<2)|0)+272>>2];if(e){h=K[Q(a,80)+222180>>2];c=Q(a,40)+203456|0;d=P[c+32>>3];k=P[c+24>>3];P[c+32>>3]=k;d=d*P[c+16>>3]+(P[c>>3]*l+k*P[c+8>>3]);P[c+24>>3]=d;if(S(d)<2147483648){c=~~d}else{c=-2147483648}g=Q(c,Q(e,h>>14))+g|0}a=a+1|0;if((a|0)!=9){continue}break}}f=f+g|0}b=0;a=K[50776];T:{if((a|0)>=K[50773]){break T}c=K[50778];b=K[50772];g=K[50774];U:{if(!g){b=b+(a+c|0)|0;g=L[b|0];b=I[b+1|0];e=a+2|0;K[50776]=e;a=g|b<<8;break U}e=a+1|0;K[50776]=e;a=Q(g,I[b+(a+c|0)|0])}b=(Q(Q(a,K[50780])>>10,K[50775])|0)/32|0;a=K[50777];if((a|0)>(c+e|0)){break T}K[50778]=c+((Q(a,3)|0)/-4|0)}a=K[51293];c=a+1|0;K[51293]=c;a=((Q(K[54739],f>>8)>>13)+b|0)+(Q(K[50755],J[(a<<1)+205184>>1])>>8)|0;if((c|0)>=5500){K[51293]=0}c=K[33073];b=Q(c,a);V:{W:{if((b|0)>=8388608){g=8388608/(a|0)|0;if((c|0)>=(g|0)){break W}break V}if((b|0)>-8388353){break V}g=-8388608/(a|0)|0;if((c|0)<(g|0)){break V}}c=g-1|0;K[33073]=c;b=Q(a,c)}a=K[51290];K[51290]=a+1;c=a;a=b>>8;I[c|0]=a;c=K[51290];K[51290]=c+1;I[c|0]=b>>>16;c=K[50756];X:{if(!c){break X}c=K[c+8>>2];if(!c){break X}wa[c|0](a<<16>>16)}c=K[51292];b=c+1|0;K[51292]=b;J[(c<<1)+205184>>1]=a;if((b|0)>=5500){K[51292]=0}if(N[54046]>=K[51290]+2>>>0){continue}break}e=1;break j}K[50773]=0}K[54731]=K[54729];e=1;h=a&65535;b=L[218920];g=K[c+8>>2];f=K[c+12>>2];d=0;k=0;c=sa+-64|0;sa=c;i=K[50759];a=K[i+132>>2];Y:{if((a|0)==6){m=sa-752|0;sa=m;Z:{if(b){break Z}a=m+376|0;Ea(a,0,376);Ge(i,g,a);a=Ea(m,0,376);Ge(i,f,a);b=K[50768]+Q(K[50769],h>>>6|0)|0;K[50768]=b;b=b>>8;b=K[50770]+(Q(K[50771],L[K[50766]+((b|0)>=127?127:b)|0])>>8)|0;K[50767]=b;P[a+368>>3]=(b|0)/4096|0;if(K[50773]){P[a+736>>3]=P[a+736>>3]/5;P[a+360>>3]=P[a+360>>3]/5}b=K[K[56797]+4>>2];wa[K[K[b>>2]>>2]](b,a+376|0,110,110,-1,0);f=h-110|0;i=K[50758];b=K[50757];_:{while(1){$:{b=(b+1|0)%170|0;if((i|0)==(b|0)){break $}n=K[(b<<4)+216192>>2];if(n-5>>>0<2){break $}g=1;if((n|0)!=1){continue}break _}break}f=h-220|0;g=0}if((f|0)>0){b=K[K[56797]+4>>2];wa[K[K[b>>2]>>2]](b,a,f,f?f:1,-1,0)}if(g){break Z}K[a+352>>2]=0;K[a+356>>2]=0;P[a>>3]=P[a+368>>3];b=K[K[56797]+4>>2];wa[K[K[b>>2]>>2]](b,a,55,55,-1,0);K[a+360>>2]=0;K[a+364>>2]=0;b=K[K[56797]+4>>2];wa[K[K[b>>2]>>2]](b,a,55,55,-1,0)}a=K[K[56797]+8>>2];b=K[51290];h=wa[K[K[a>>2]>>2]](a,K[54046]-b>>>1|0,b)|0;i=K[51290];aa:{if(!h){break aa}b=K[50776];u=K[50773];if((b|0)>=(u|0)){break aa}v=K[50777];y=(Q(v,3)|0)/-4|0;d=+K[50780]*.0009765625;n=K[50772];f=K[50778];z=K[50775];p=K[50774];a=0;while(1){g=b+f|0;o=L[n+g|0];ba:{if(!p){b=b+1|0;K[50776]=b;g=b+f|0;o=o|I[n+g|0]<<8;break ba}o=Q(p,o<<24>>24)}l=d*+(o|0);ca:{if(S(l)<2147483648){o=~~l;break ca}o=-2147483648}w=i+(a<<1)|0;J[w>>1]=M[w>>1]+((Q(o,z)|0)/40|0);if((g|0)>=(v|0)){f=f+y|0;K[50778]=f}b=b+1|0;K[50776]=b;if((b|0)>=(u|0)){break aa}a=a+1|0;if(h>>>0>a>>>0){continue}break}}a=i+(h<<1)|0;K[51290]=a;sa=m+752|0;a=N[54046]<=a>>>0;break Y}if(!b){if(a-1>>>0<=4){K[55921]=a;K[55964]=K[(a<<2)+110896>>2]}a=K[i+88>>2];K[54741]=1;K[55922]=(a|0)/32;b=K[50758];a=K[50757];while(1){da:{a=a+1|0;a=(a|0)<=169?a:0;if((b|0)==(a|0)){break da}m=K[(a<<4)+216192>>2];if((m|0)==1){K[54741]=0;a=K[((a<<4)+216192|0)+8>>2];if(!(M[f+4>>1]!=M[a+4>>1]|M[a+6>>1]!=M[f+6>>1]|(M[a+8>>1]!=M[f+8>>1]|M[a+10>>1]!=M[f+10>>1]))){if(M[a+12>>1]==M[f+12>>1]){break da}}K[54741]=2;break da}if(m-5>>>0>1){continue}}break}ea:{if(!(M[g+4>>1]!=M[113564]|M[g+6>>1]!=M[113565]|(M[g+8>>1]!=M[113566]|M[g+10>>1]!=M[113567]))){if(M[g+12>>1]==M[113568]){break ea}}id();K[55974]=0;K[55975]=0;K[55972]=0;K[55973]=0;K[55988]=0;K[55989]=0;K[55990]=0;K[55991]=0;K[56004]=0;K[56005]=0;K[56006]=0;K[56007]=0;K[56020]=0;K[56021]=0;K[56022]=0;K[56023]=0;K[56036]=0;K[56037]=0;K[56038]=0;K[56039]=0;K[56052]=0;K[56053]=0;K[56054]=0;K[56055]=0;K[56068]=0;K[56069]=0;K[56070]=0;K[56071]=0;K[56086]=0;K[56087]=0;K[56084]=0;K[56085]=0;K[56102]=0;K[56103]=0;K[56100]=0;K[56101]=0;K[56118]=0;K[56119]=0;K[56116]=0;K[56117]=0;K[56134]=0;K[56135]=0;K[56132]=0;K[56133]=0;K[56150]=0;K[56151]=0;K[56148]=0;K[56149]=0;K[56166]=0;K[56167]=0;K[56164]=0;K[56165]=0;K[56182]=0;K[56183]=0;K[56180]=0;K[56181]=0;K[56198]=0;K[56199]=0;K[56196]=0;K[56197]=0;K[56214]=0;K[56215]=0;K[56212]=0;K[56213]=0;K[56230]=0;K[56231]=0;K[56228]=0;K[56229]=0}a=M[f+4>>1]|M[f+6>>1]<<16;b=M[f>>1]|M[f+2>>1]<<16;J[113562]=b;J[113563]=b>>>16;J[113564]=a;J[113565]=a>>>16;a=M[f+60>>1]|M[f+62>>1]<<16;b=M[f+56>>1]|M[f+58>>1]<<16;J[113590]=b;J[113591]=b>>>16;J[113592]=a;J[113593]=a>>>16;a=M[f+52>>1]|M[f+54>>1]<<16;b=M[f+48>>1]|M[f+50>>1]<<16;J[113586]=b;J[113587]=b>>>16;J[113588]=a;J[113589]=a>>>16;a=M[f+44>>1]|M[f+46>>1]<<16;b=M[f+40>>1]|M[f+42>>1]<<16;J[113582]=b;J[113583]=b>>>16;J[113584]=a;J[113585]=a>>>16;a=M[f+36>>1]|M[f+38>>1]<<16;b=M[f+32>>1]|M[f+34>>1]<<16;J[113578]=b;J[113579]=b>>>16;J[113580]=a;J[113581]=a>>>16;a=M[f+28>>1]|M[f+30>>1]<<16;b=M[f+24>>1]|M[f+26>>1]<<16;J[113574]=b;J[113575]=b>>>16;J[113576]=a;J[113577]=a>>>16;a=M[f+20>>1]|M[f+22>>1]<<16;b=M[f+16>>1]|M[f+18>>1]<<16;J[113570]=b;J[113571]=b>>>16;J[113572]=a;J[113573]=a>>>16;a=M[f+12>>1]|M[f+14>>1]<<16;b=M[f+8>>1]|M[f+10>>1]<<16;J[113566]=b;J[113567]=b>>>16;J[113568]=a;J[113569]=a>>>16;l=+(h|0);o=J[g>>1]&1;fa:{if(o){a=L[g+39|0];K[56680]=a;P[28364]=a>>>0;P[28354]=+(L[f+39|0]-a<<6)/l;a=L[g+40|0];P[28366]=a>>>0;P[28356]=+(L[f+40|0]-a<<6)/l;a=L[g+41|0];K[56682]=a;P[28368]=a>>>0;P[28358]=+(L[f+41|0]-a<<6)/l;b=L[g+42|0];K[56684]=b;P[28370]=b>>>0;a=L[g+43|0];d=+(L[f+43|0]-a<<6)/l;k=+(L[f+42|0]-b<<6)/l;j=+(a>>>0);break fa}K[56728]=0;K[56729]=0;a=0;K[56680]=0;K[56708]=0;K[56709]=0;K[56732]=0;K[56733]=0;K[56712]=0;K[56713]=0;K[56682]=0;K[56736]=0;K[56737]=0;K[56716]=0;K[56717]=0;K[56684]=0;K[56740]=0;K[56741]=0;j=0}K[56688]=a;P[28360]=k;P[28372]=j;P[28362]=d;K[56692]=0;K[56748]=0;K[56749]=0;K[56694]=0;K[56752]=0;K[56753]=0;K[56696]=0;K[56756]=0;K[56757]=0;K[56700]=0;K[56760]=0;K[56761]=0;K[56704]=0;K[56764]=0;K[56765]=0;K[50764]=h;a=1;while(1){h=a<<1;m=h+i|0;n=J[m+164>>1];u=Q(a,80);b=u+222896|0;k=+J[m+218>>1];d=+(Q(n,J[(g+h|0)+2>>1])|0)*.00390625+k;P[b+16>>3]=d;if(S(d)<2147483648){p=~~d}else{p=-2147483648}K[b>>2]=p;P[b+48>>3]=(+(Q(n,J[(f+h|0)+2>>1])|0)*.00390625+k-d)*64/l;if(a>>>0<=3){b=u+222896|0;d=+J[m+200>>1]*.00390625*+(L[(a+g|0)+35|0]<<1);P[b+24>>3]=d;if(S(d)<2147483648){h=~~d}else{h=-2147483648}K[b+4>>2]=h;P[b+56>>3]=(+(L[(a+f|0)+35|0]<<1)-d)*64/l}a=a+1|0;if((a|0)!=6){continue}break}a=L[g+40|0];d=+(a<<1);P[27864]=d;b=K[56618];if(!a){d=+(b|0);P[27864]=d}if(S(d)<2147483648){a=~~d}else{a=-2147483648}K[55724]=a;h=L[f+40|0];K[55730]=0;K[55731]=1079394304;K[55738]=0;K[55739]=0;K[55725]=89;a=1;P[27868]=(+((h?h<<1:b)|0)-d)*64/l;if(o){while(1){b=Q(a,80)+222896|0;h=a+g|0;i=L[h+56|0]<<2;K[b+12>>2]=i;d=+(i|0);P[b+40>>3]=d;i=a+f|0;P[b+72>>3]=(+(L[i+56|0]<<2)-d)*64/l;h=L[h+49|0];K[b+8>>2]=h;d=+(h>>>0);P[b+32>>3]=d;P[b- -64>>3]=(+L[i+49|0]-d)*64/l;a=a+1|0;if((a|0)!=7){continue}break}}K[56606]=0}while(1){p=K[50764];f=K[56606];if((p|0)>(f|0)){a=K[50767];K[56609]=K[55724];K[56619]=K[55725];K[56610]=K[55744];K[56611]=K[55764];K[56612]=K[55784];K[56613]=K[55804];o=Q(a,10);K[56607]=(o|0)/4096;K[56620]=K[55745];K[56621]=K[55765];K[56622]=K[55785];K[56614]=K[55824];K[56630]=K[55746];K[56631]=K[55766];K[56632]=K[55786];K[56633]=K[55806];K[56634]=K[55826];K[56635]=K[55846];u=K[56680];K[56608]=u;g=K[56694];K[56656]=g;h=K[56696];K[56653]=h;i=K[56700];K[56655]=i;m=K[56684];K[56649]=m;K[56651]=K[56704];K[56654]=K[56688];K[56652]=K[56682];K[56650]=K[56692];a=0;while(1){b=Q(a,80)+222896|0;d=P[b+48>>3]+P[b+16>>3];P[b+16>>3]=d;l=P[b+56>>3]+P[b+24>>3];P[b+24>>3]=l;k=P[b+72>>3]+P[b+40>>3];P[b+40>>3]=k;j=P[b- -64>>3]+P[b+32>>3];P[b+32>>3]=j;if(S(d)<2147483648){n=~~d}else{n=-2147483648}K[b>>2]=n;if(S(l)<2147483648){n=~~l}else{n=-2147483648}K[b+4>>2]=n;if(S(k)<2147483648){n=~~k}else{n=-2147483648}K[b+12>>2]=n;if(S(j)<2147483648){n=~~j}else{n=-2147483648}K[b+8>>2]=n;a=a+1|0;if((a|0)!=9){continue}break}d=P[28354]+P[28364];P[28364]=d;P[28366]=P[28356]+P[28366];l=P[28358]+P[28368];P[28368]=l;k=P[28360]+P[28370];P[28370]=k;j=P[28362]+P[28372];P[28372]=j;if(S(d)<2147483648){a=~~d}else{a=-2147483648}K[56680]=a;if(S(l)<2147483648){a=~~l}else{a=-2147483648}K[56682]=a;if(S(k)<2147483648){a=~~k}else{a=-2147483648}K[56684]=a;if(S(j)<2147483648){a=~~j}else{a=-2147483648}K[56688]=a;d=P[28374]+0;P[28374]=d;if(S(d)<2147483648){a=~~d}else{a=-2147483648}K[56692]=a;d=P[28376]+0;P[28376]=d;if(S(d)<2147483648){a=~~d}else{a=-2147483648}K[56694]=a;d=P[28378]+0;P[28378]=d;if(S(d)<2147483648){a=~~d}else{a=-2147483648}K[56696]=a;d=P[28380]+0;P[28380]=d;if(S(d)<2147483648){a=~~d}else{a=-2147483648}K[56700]=a;d=P[28382]+0;P[28382]=d;if(S(d)<2147483648){a=~~d}else{a=-2147483648}K[56704]=a;K[56659]=K[55724];K[56669]=K[55725];K[56660]=K[55744];K[56670]=K[55745];K[56661]=K[55764];K[56671]=K[55765];K[56662]=K[55784];K[56672]=K[55785];K[56663]=K[55804];K[56664]=K[55824];K[56665]=K[55844];a=K[50768]+K[50769]|0;K[50768]=a;a=a>>8;K[50767]=K[50770]+(Q(K[50771],L[K[50766]+((a|0)>=127?127:a)|0])>>8);a=p-f|0;K[55923]=(a|0)>=64?64:a;K[55961]=(o|0)/40960;a=u-7|0;K[56658]=(a|0)>0?a:0;P[27974]=m>>>0<=87?+J[(m<<1)+111136>>1]*.001*.05:0;P[27975]=h>>>0<=87?+J[(h<<1)+111136>>1]*.001*.25:0;P[27973]=g>>>0<=87?+J[(g<<1)+111136>>1]*.001:0;P[27971]=i>>>0<=87?+J[(i<<1)+111136>>1]*.001*.05:0;a=K[56629];if(a>>>0<=87){d=+J[(a<<1)+111136>>1]*.001*.6}else{d=0}P[c>>3]=d;a=K[56630];if(a>>>0<=87){d=+J[(a<<1)+111136>>1]*.001*.4}else{d=0}P[c+8>>3]=d;a=K[56631];if(a>>>0<=87){d=+J[(a<<1)+111136>>1]*.001*.15}else{d=0}P[c+16>>3]=d;a=K[56632];if(a>>>0<=87){d=+J[(a<<1)+111136>>1]*.001*.06}else{d=0}P[c+24>>3]=d;a=K[56633];if(a>>>0<=87){d=+J[(a<<1)+111136>>1]*.001*.04}else{d=0}P[c+32>>3]=d;a=K[56634];if(a>>>0<=87){d=+J[(a<<1)+111136>>1]*.001*.022}else{d=0}P[c+40>>3]=d;a=K[56635];if(a>>>0<=87){d=+J[(a<<1)+111136>>1]*.001*.03}else{d=0}P[c+48>>3]=d;a=K[56657]-3|0;a=(a|0)<=0?57:a;if(a>>>0<=87){d=+J[(a<<1)+111136>>1]*.001}else{d=0}P[27977]=d/+K[55964];l=P[27968];k=P[27967];a=1;while(1){f=a<<6;b=f+223664|0;g=a<<2;h=g+226428|0;d=nb(k*+K[h+48>>2]);j=d*-d;P[b+216>>3]=j;d=d*hb(l*+K[h+8>>2]);d=d+d;P[b+208>>3]=d;s=1-d-j;P[b+200>>3]=s;if(a>>>0<=5){g=g+226428|0;h=K[g+208>>2];b=f+223664|0;q=nb(k*+K[g+248>>2]);r=q*hb(l*+(h|0));r=r+r;P[b+1488>>3]=r;q=q*-q;P[b+1496>>3]=q;t=1-r-q;P[b+1480>>3]=t;P[b+256>>3]=(q-j)*.015625;P[b+248>>3]=(r-d)*.015625;P[b+240>>3]=(t-s)*.015625}a=a+1|0;if((a|0)!=10){continue}break}d=nb(k*+K[56619]);q=d*-d;P[27985]=q;d=d*hb(l*+(0-K[56609]|0));r=d+d;P[27984]=r;d=1-r-q;P[27983]=d;if(d!=0){d=1/d;P[27983]=d;j=-d;q=q*j;P[27985]=q;r=r*j;P[27984]=r}j=nb(k*+K[56669]);s=j*-j;P[28145]=s;j=j*hb(l*+(0-K[56659]|0));t=j+j;P[28144]=t;j=1-t-s;P[28143]=j;if(j!=0){j=1/j;P[28143]=j;x=-j;s=s*x;P[28145]=s;t=t*x;P[28144]=t}P[27990]=(s-q)*.015625;P[27989]=(t-r)*.015625;P[27988]=(j-d)*.015625;a=0;while(1){f=(a<<2)+226428|0;g=K[f+8>>2];b=(a<<6)+223664|0;d=nb(k*+K[f+128>>2]);j=d*hb(l*+(g|0));j=j+j;P[b+848>>3]=j;d=d*-d;P[b+856>>3]=d;P[b+840>>3]=P[c+(a<<3)>>3]*(1-j-d);a=a+1|0;if((a|0)!=7){continue}break}d=nb(k*+(K[55918]/2|0));k=d*-d;P[28137]=k;d=d*hb(l*0);d=d+d;P[28136]=d;P[28135]=1-d-k;a=1;if((He()|0)!=1){continue}break Y}break}a=1;if(K[54741]>0){K[54741]=0;K[55963]=64;K[56606]=f+-64;K[55923]=64;if((He()|0)==1){break Y}}a=0}sa=c- -64|0;if(a){break j}break k}K[50781]=a?a:100;break k}jd(a,K[c+8>>2]);break k}a=K[c+8>>2];K[50759]=Fa(203816,a,1344);K[50801]=K[a+108>>2]?105792:106064;a=(Q(K[a+120>>2],26)|0)/100|0;K[33038]=a;e=K[50754];if((e|0)<=11e3){I[203300]=1;K[33038]=a<<1}K[54728]=K[50982];a=K[50979];b=K[50978];Ea(205184,0,11e3);K[51293]=0;f=K[50789];g=(f|0)>0;b=g?130:(b|0)>=5499?5499:b;a=b?g?f:(a|0)>=100?100:a:0;K[50755]=a;b=(Q(b,e)|0)/1e3|0;K[51292]=b;K[54729]=(a|0)>20?b<<1:a?b:0;K[33037]=(Q(500-a|0,(Q(L[K[50797]+105596|0],(Q(K[50787],55)|0)/100|0)|0)/16|0)|0)/500;a=256;b=K[50785];b=(b|0)>=101?101:b;if((b|0)>=51){a=(((Q(b,25)-1250&65535)>>>0)/50|0)+256|0}J[101990]=(Q(J[102026],a)|0)/256;J[101991]=(Q(J[102027],a)|0)/256;J[101992]=(Q(J[102028],a)|0)/256;J[101993]=(Q(J[102029],a)|0)/256;J[101994]=(Q(J[102030],a)|0)/256;J[101995]=(Q(J[102031],a)|0)/256;a=K[50790];J[101999]=(Q(J[102035],Q(a,-6)+256|0)|0)/256;J[102e3]=(Q(J[102036],Q(a,-3)+256|0)|0)/256;_e(8,0,K[50986],0,K[51290]);Ha(K[c+8>>2]);break k}if(!K[50759]){break k}b=K[c+12>>2];c=K[c+8>>2];K[55911]=0;K[55915]=a?2097152/(a|0)|0:0;K[55910]=c;a=(Q(b,K[33037])|0)/16|0;K[50779]=a;K[50780]=(Q(Q(a,K[50985]),15)|0)/100;break k}_e(b>>8,a,K[c+8>>2],K[c+12>>2],g)}e=0;a=K[50757]+1|0;K[50757]=(a|0)<=169?a:0}I[218920]=e;g=K[51290];if(g>>>0<N[54046]){continue}break}}f=K[34391];c=(K[51290]-f|0)/2|0;K[34439]=c+K[34439];b=K[34436];a=K[34388]+Q(b,36)|0;K[a+4>>2]=0;K[a>>2]=0;K[a+24>>2]=K[34438];a=K[32538];ga:{if(a&2){g=K[34388];ha:{if((a&-2)!=2){break ha}c=b?g:0;if(!c|K[c>>2]!=8){break ha}c=K[c+28>>2];if((c|0)==K[34389]){break ha}K[34389]=c}e=1;if((b|0)<2){break ga}while(1){c=b?g+Q(e,36)|0:0;ia:{ja:{switch(a|0){case 2:case 3:if(!c|K[c>>2]!=8){break ia}c=K[c+28>>2];if((c|0)==K[34389]){break ia}K[34389]=c;break ia;case 0:break ja;default:break ia}}a=K[34440];if(!a){a=0;break ia}wa[a|0](f,0,c)|0;b=K[34436];a=K[32538]}e=e+1|0;if((e|0)<(b|0)){continue}break}break ga}a=K[34440];if(!a){break ga}if(wa[a|0](f,c,K[34388])|0){break f}}if(Te(1)){continue}a=K[50757]-K[50758]|0;if(170-((a|0)<=0?a+170|0:a)|0){continue}a=K[34388];K[a>>2]=0;K[a+4>>2]=K[34437];K[a+24>>2]=K[34438];if(sd(1)){continue}break}b=0;if(L[130152]&2){break d}a=K[34440];if(!a){break d}if(!(wa[a|0](0,0,K[34388])|0)){break d}}sd(2);b=268439295}if((b|0)<=268437502){if(!b|(b|0)==268436479|(b|0)!=268437247){break a}return}if((b|0)==268437503|(b|0)==268437759|(b|0)==268439295){break a}}}function Te(a){var b=0,c=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0;b=sa-720|0;sa=b;c=K[47198];a:{if(a){break a}K[36443]=0;K[36442]=1;K[36444]=0;K[36440]=0;K[36441]=0;a=K[50758];K[36454]=a;K[36427]=-1;K[36424]=-1;K[36446]=0;K[36447]=0;K[36439]=-1;K[36426]=0;K[36455]=a;K[36448]=0;K[36449]=0;K[36450]=0;K[36451]=0;K[36452]=0;K[36453]=0;Nb();K[36427]=-1;a=(K[50758]<<4)+216192|0;K[a>>2]=5;K[a+4>>2]=0;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0;K[36426]=0;if(!K[36438]){break a}K[36438]=0;a=(K[50758]<<4)+216192|0;K[a>>2]=14;K[a+4>>2]=0;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0}a=K[36442];b:{c:{if((a|0)>997|K[36423]<=(a|0)){break c}o=c>>>1&1;p=b+48|4;q=b+348|0;r=b+652|0;s=K[32322];l=K[32320];t=b+60|0;u=b+648|0;v=b+56|0;w=b+620|0;m=b- -64|0;while(1){d=(a<<5)+145840|0;a=K[50756];if(!(!a|!K[a>>2])){K[b+12>>2]=0;a=b+16|0;Eb(a,K[d+8>>2],d,0,b+12|0);c=oc(a);e=L[d+17|0];a=(K[50758]<<4)+216192|0;K[a>>2]=16;K[a+8>>2]=e;K[a+4>>2]=c;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0}c=K[50757]-K[50758]|0;e=(c|0)<=0?c+170|0:c;c=L[d+17|0];a=1;if((e|0)<=((c?(c|0)==2?25:15:10)|0)){break b}j=K[36442];if(L[d|0]&2){k=M[d+4>>1]&2047;while(1){e=K[36443];c=K[(e<<2)+198304>>2];h=c&127;if(h){a=c>>>8|0;K[36443]=e+1;d:{e:{f:{switch((c&31)-2|0){case 0:jd(c&96|8,a);Hc(2);break d;case 5:if((a|0)>=K[34064]){break d}e=a<<4;h=e+136272|0;if(!K[h+4>>2]){break d}tb(10,0);a=(K[50758]<<4)+216192|0;K[a>>2]=6;h=K[h+4>>2];K[a+8>>2]=K[(e+136272|0)+8>>2]+44;K[a+12>>2]=5376;K[a+4>>2]=h;break e;case 8:e=K[50757]-K[50758]|0;if((((e|0)<=0?e+170|0:e)|0)<6){break d}h=K[47353];e=(K[50758]<<4)+216192|0;K[e>>2]=778;K[e+8>>2]=a;K[e+4>>2]=h+k&16777215;break e;case 9:e=K[50757]-K[50758]|0;if((((e|0)<=0?e+170|0:e)|0)<6){break d}h=K[33284];e=(K[50758]<<4)+216192|0;K[e>>2]=1034;K[e+8>>2]=a;K[e+4>>2]=h+1&16777215;break e;default:break f}}tb(10,0);e=(K[50758]<<4)+216192|0;K[e>>2]=12;K[e+8>>2]=a;K[e+4>>2]=h}a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0}if(!(c&128)){continue}}break}}a=L[d+20|0];g:{if(!a){break g}if(!(I[K[47192]+48|0]&1&L[d+17|0]==2|I[K[d+8>>2]+7|0]&1)){K[36426]=0}c=K[47353]+(M[d+4>>1]&2047)|0;K[36445]=c;h:{if(!(a&4)){break h}a=K[50757]-K[50758]|0;if((((a|0)<=0?a+170|0:a)|0)<6){break h}e=K[47568];a=(K[50758]<<4)+216192|0;K[a>>2]=522;K[a+8>>2]=e;K[a+4>>2]=c&16777215;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0}if(!(I[d+20|0]&1)){break g}c=M[d+4>>1];e=K[36444];K[36444]=e+1;a=K[50757]-K[50758]|0;if((((a|0)<=0?a+170|0:a)|0)<6){break g}k=K[36445];h=K[47355];a=(K[50758]<<4)+216192|0;K[a>>2]=266;K[a+8>>2]=e+h;K[a+4>>2]=k&16777215|(c&63488)<<13;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0}a=K[36441];if((a|0)>0){c=(K[36425]<<4)+216192|0;if(!K[c+4>>2]){K[c+4>>2]=a}K[36441]=0}a=j+1<<5;c=j-1<<5;e=L[d+18|0];if(!(!e|L[K[d+8>>2]+7|0]&2)){tb(e,1)}h=a+145840|0;f=c+145840|0;k=1;i:{j:{k:{if(!K[47198]){break k}i=K[d+8>>2];if(L[i+10|0]==15){break k}l:{if(L[d+17|0]!=2){break l}switch(L[f+17|0]-3|0){case 0:case 5:break j;default:break l}}k=0;Eb(b+704|0,i,d,o,0);a=K[50757]-K[50758]|0;if((((a|0)<=0?a+170|0:a)|0)<6){break k}c=K[36445];a=(K[50758]<<4)+216192|0;K[a>>2]=1802;K[a+4>>2]=c&16777215;c=K[b+708>>2];K[a+8>>2]=K[b+704>>2];K[a+12>>2]=c;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0}m:{switch(L[d+17|0]){case 0:tb(K[d+12>>2],0);I[d+23|0]=L[K[d+8>>2]+14|0];break i;case 4:c=K[d+8>>2];a=L[h+17|0];if(!((a|0)==2|!L[h+20|0]&(a|0)==3)){J[d>>1]=M[d>>1]|8192}if(L[c+7|0]&2){K[b+88>>2]=0;K[b+92>>2]=0;K[b+80>>2]=0;K[b+84>>2]=0;K[b+72>>2]=0;K[b+76>>2]=0;K[m>>2]=0;K[m+4>>2]=0;K[b+56>>2]=0;K[b+60>>2]=0;K[b+48>>2]=0;K[b+52>>2]=0;bb(0,1,d,b+552|0,145784);K[b+56>>2]=K[b+620>>2];K[m>>2]=K[b+640>>2];if(K[36424]<0){e=L[h+19|0];a=K[50758];K[36425]=a;K[36441]=0;a=(a<<4)+216192|0;K[a+12>>2]=e;K[a+8>>2]=0;K[a>>2]=8;K[a+4>>2]=0;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0;k=L[h+22|0];e=L[h+21|0];h=K[(L[d+16|0]<<2)+129280>>2];a=K[36424];i=K[36440];n:{if((a|0)<0|(i|0)<=0){break n}a=(a<<4)+216192|0;if(K[a+4>>2]){break n}K[a+4>>2]=i}a=K[50758];K[36424]=a;K[36440]=0;a=(a<<4)+216192|0;K[a>>2]=9;K[a+4>>2]=0;k=k|e<<16;e=(e|0)==255;K[a+12>>2]=e?3604556:k;K[a+8>>2]=e?l:h;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0}db(c,0,b+48|0,d,0)}bb(0,0,d,b+552|0,145784);K[b+552>>2]=K[b+552>>2]|4;a=K[36440];o:{if((a|0)<=0){break o}c=K[36424];if((c|0)<0){break o}c=(c<<4)+216192|0;if(!K[c+4>>2]){K[c+4>>2]=a}K[36440]=0}K[36426]=0;K[36439]=-1;K[36455]=K[50758];Nb();K[36427]=-1;K[36422]=0;a=K[b+624>>2];if(a){e=a;a=K[b+644>>2];Fc(e,2,K[b+596>>2]<<1,K[b+552>>2],0,a?(a<<5)/100|0:32)}K[36426]=0;break i;case 6:bb(0,0,d,b+552|0,145784);p:{if(!(L[d|0]&8)){break p}a=K[d+12>>2];c=K[36440];q:{if((c|0)<=0){break q}e=K[36424];if((e|0)<0){break q}e=(e<<4)+216192|0;if(!K[e+4>>2]){K[e+4>>2]=c}K[36440]=0}K[36426]=0;K[36439]=-1;K[36455]=K[50758];Nb();K[36427]=-1;K[36422]=0;c=K[b+624>>2];if(!c){break p}e=a;a=K[b+644>>2];Fc(c,2,K[b+596>>2]<<1,K[b+552>>2],e,a?(a<<5)/100|0:32)}a=K[d+12>>2];c=K[36440];r:{if((c|0)<=0){break r}e=K[36424];if((e|0)<0){break r}e=(e<<4)+216192|0;if(!K[e+4>>2]){K[e+4>>2]=c}K[36440]=0}K[36426]=0;K[36439]=-1;K[36455]=K[50758];Nb();K[36427]=-1;K[36422]=0;c=K[b+624>>2];if(c){e=a;a=K[b+644>>2];Fc(c,2,K[b+596>>2]<<1,K[b+552>>2],e,a?(a<<5)/100|0:32)}K[36426]=0;break i;case 5:e=K[d+8>>2];K[p+40>>2]=0;a=p;K[a+32>>2]=0;K[a+36>>2]=0;K[a+24>>2]=0;K[a+28>>2]=0;K[a+16>>2]=0;K[a+20>>2]=0;K[a+8>>2]=0;K[a+12>>2]=0;K[a>>2]=0;K[a+4>>2]=0;K[b+48>>2]=4;s:{t:{u:{v:{switch(L[h+17|0]-2|0){case 0:c=L[d+19|0];a=K[50758];K[36425]=a;K[36441]=0;a=(a<<4)+216192|0;K[a+12>>2]=c;K[a+8>>2]=0;K[a>>2]=8;K[a+4>>2]=0;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0;c=L[d+22|0];i=L[d+21|0];k=K[(L[d+16|0]<<2)+129280>>2];a=K[36424];g=K[36440];w:{if((a|0)<0|(g|0)<=0){break w}a=(a<<4)+216192|0;if(K[a+4>>2]){break w}K[a+4>>2]=g}g=(i&255)==255;a=g?l:k;k=1;break t;case 1:break v;default:break u}}if(L[h+20|0]){break u}c=L[h+19|0];a=K[50758];K[36425]=a;K[36441]=0;a=(a<<4)+216192|0;K[a+12>>2]=c;K[a+8>>2]=0;K[a>>2]=8;K[a+4>>2]=0;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0;c=L[h+22|0];i=L[h+21|0];k=K[(L[h+16|0]<<2)+129280>>2];a=K[36424];g=K[36440];x:{if((a|0)<0|(g|0)<=0){break x}a=(a<<4)+216192|0;if(K[a+4>>2]){break x}K[a+4>>2]=g}g=(i&255)==255;a=g?l:k;k=1;break t}k=0;if(K[36424]>=0){break s}c=L[h+19|0];a=K[50758];K[36425]=a;K[36441]=0;a=(a<<4)+216192|0;K[a+12>>2]=c;K[a+8>>2]=0;K[a>>2]=8;K[a+4>>2]=0;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0;c=L[d+22|0];i=L[d+21|0];k=K[(L[d+16|0]<<2)+129280>>2];a=K[36424];g=K[36440];y:{if((a|0)<0|(g|0)<=0){break y}a=(a<<4)+216192|0;if(K[a+4>>2]){break y}K[a+4>>2]=g}g=(i&255)==255;a=g?l:k;k=0}n=K[50758];K[36424]=n;K[36440]=0;n=(n<<4)+216192|0;K[n>>2]=9;K[n+4>>2]=0;K[n+12>>2]=g?3604556:c&255|(i&255)<<16;K[n+8>>2]=a;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0}z:{if(!(!(L[e+7|0]&2)&L[f+17|0]!=2)){bb(0,1,d,b+552|0,145784);K[b+56>>2]=K[b+620>>2];K[b+64>>2]=K[b+640>>2];db(e,0,b+48|0,d,0);if(!(L[d|0]&8)){break z}tb(25,1);db(e,0,b+48|0,d,0);break z}if(!(L[d|0]&8)){break z}tb(50,0)}A:{if(k){if(K[36455]!=K[36454]){break A}K[36455]=K[50758];break A}J[d>>1]=M[d>>1]|8192}bb(0,0,d,b+552|0,145784);K[b+56>>2]=K[b+620>>2];K[b+64>>2]=K[b+640>>2];K[b+76>>2]=K[b+636>>2];K[b+80>>2]=K[b+656>>2];db(e,0,b+48|0,d,0);if(L[d+20|0]|L[((j<<5)+145840|0)+84|0]){break i}a=L[h+17|0];if((a|0)==7){tb(20,0);a=L[h+17|0]}if((a&255)!=6){break i}tb(12,0);break i;case 7:B:{C:{D:{E:{F:{a=L[h+17|0];switch(a-2|0){case 1:break E;case 0:break F;default:break D}}c=L[d+19|0];a=K[50758];K[36425]=a;K[36441]=0;a=(a<<4)+216192|0;K[a+12>>2]=c;K[a+8>>2]=0;K[a>>2]=8;K[a+4>>2]=0;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0;k=L[d+22|0];a=L[d+21|0];e=K[(L[d+16|0]<<2)+129280>>2];c=K[36424];i=K[36440];G:{if((c|0)<0|(i|0)<=0){break G}c=(c<<4)+216192|0;if(K[c+4>>2]){break G}K[c+4>>2]=i}i=(a&255)==255;c=i?l:e;break C}c=L[h+19|0];a=K[50758];K[36425]=a;K[36441]=0;a=(a<<4)+216192|0;K[a+12>>2]=c;K[a+8>>2]=0;K[a>>2]=8;K[a+4>>2]=0;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0;k=L[h+22|0];a=L[h+21|0];e=K[(L[h+16|0]<<2)+129280>>2];c=K[36424];i=K[36440];H:{if((c|0)<0|(i|0)<=0){break H}c=(c<<4)+216192|0;if(K[c+4>>2]){break H}K[c+4>>2]=i}i=(a&255)==255;c=i?l:e;break C}if(K[36424]>=0){break B}c=L[d+19|0];a=K[50758];K[36425]=a;K[36441]=0;a=(a<<4)+216192|0;K[a+12>>2]=c;K[a+8>>2]=0;K[a>>2]=8;K[a+4>>2]=0;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0;k=L[d+22|0];a=L[d+21|0];e=K[(L[d+16|0]<<2)+129280>>2];c=K[36424];i=K[36440];I:{if((c|0)<0|(i|0)<=0){break I}c=(c<<4)+216192|0;if(K[c+4>>2]){break I}K[c+4>>2]=i}i=(a&255)==255;c=i?l:e}e=K[50758];K[36424]=e;K[36440]=0;e=(e<<4)+216192|0;K[e>>2]=9;K[e+4>>2]=0;K[e+12>>2]=i?3604556:(a&255)<<16|k;K[e+8>>2]=c;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0;a=L[h+17|0]}J:{K:{L:{switch((a&255)-2|0){case 1:if(L[h+20|0]){break K}break;case 0:break L;default:break K}}if(K[36455]!=K[36454]){break J}K[36455]=K[50758];break J}J[d>>1]=M[d>>1]|8192}bb(0,0,d,b+552|0,145784);K[b+56>>2]=0;K[b+60>>2]=0;K[m>>2]=0;K[m+4>>2]=0;K[b+80>>2]=0;K[b+84>>2]=0;K[b+72>>2]=0;K[b+76>>2]=0;K[b+88>>2]=0;K[b+56>>2]=K[b+620>>2];K[m>>2]=K[b+640>>2];K[b+80>>2]=K[b+656>>2];K[b+48>>2]=0;K[b+52>>2]=0;K[b+76>>2]=K[b+636>>2];K[b+92>>2]=K[b+596>>2]<<1;if(L[d|0]&8){db(K[d+8>>2],0,b+48|0,d,0)}db(K[d+8>>2],0,b+48|0,d,0);break i;case 8:K[b+88>>2]=0;K[b+92>>2]=0;K[b+80>>2]=0;K[b+84>>2]=0;K[b+72>>2]=0;K[b+76>>2]=0;K[m>>2]=0;K[m+4>>2]=0;K[b+56>>2]=0;K[b+60>>2]=0;K[b+48>>2]=0;K[b+52>>2]=0;if(!(I[d|0]&1)){c=L[d+19|0];a=K[50758];K[36425]=a;K[36441]=0;a=(a<<4)+216192|0;K[a+12>>2]=c;K[a+8>>2]=0;K[a>>2]=8;K[a+4>>2]=0;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0;e=L[d+22|0];c=L[d+21|0];k=K[(L[d+16|0]<<2)+129280>>2];a=K[36424];i=K[36440];M:{if((a|0)<0|(i|0)<=0){break M}a=(a<<4)+216192|0;if(K[a+4>>2]){break M}K[a+4>>2]=i}a=K[50758];K[36424]=a;K[36440]=0;a=(a<<4)+216192|0;K[a>>2]=9;K[a+4>>2]=0;e=e|c<<16;c=(c|0)==255;K[a+12>>2]=c?3604556:e;K[a+8>>2]=c?l:k;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0}if(L[f+17|0]==8){K[36426]=0}bb(0,0,d,b+552|0,145784);K[b+56>>2]=K[b+620>>2];K[b+64>>2]=K[b+640>>2];K[b+92>>2]=K[b+596>>2]<<1;if(L[h+17|0]==2){if(K[36455]==K[36454]){K[36455]=K[50758]}db(K[d+8>>2],0,b+48|0,d,0);break i}if(!(!(I[d|0]&1)|L[f+17|0]!=2)){db(K[d+8>>2],0,b+48|0,d,0);break i}K[36426]=0;db(K[d+8>>2],0,b+48|0,d,0);K[36426]=0;break i;case 3:K[b+88>>2]=0;K[b+92>>2]=0;K[b+80>>2]=0;K[b+84>>2]=0;K[b+72>>2]=0;K[b+76>>2]=0;K[m>>2]=0;K[m+4>>2]=0;K[b+56>>2]=0;K[b+60>>2]=0;K[b+48>>2]=0;K[b+52>>2]=0;e=K[K[d+8>>2]+4>>2];if(!(I[d|0]&1)){c=L[d+19|0];a=K[50758];K[36425]=a;K[36441]=0;a=(a<<4)+216192|0;K[a+12>>2]=c;K[a+8>>2]=0;K[a>>2]=8;K[a+4>>2]=0;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0;k=L[d+22|0];c=L[d+21|0];i=K[(L[d+16|0]<<2)+129280>>2];a=K[36424];g=K[36440];N:{if((a|0)<0|(g|0)<=0){break N}a=(a<<4)+216192|0;if(K[a+4>>2]){break N}K[a+4>>2]=g}a=K[50758];K[36424]=a;K[36440]=0;a=(a<<4)+216192|0;K[a>>2]=9;K[a+4>>2]=0;k=k|c<<16;c=(c|0)==255;K[a+12>>2]=c?3604556:k;K[a+8>>2]=c?l:i;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0}if(L[f+17|0]==8){K[36426]=0}if(!(L[h+17|0]!=2|K[36455]!=K[36454])){K[36455]=K[50758]}bb(0,0,d,b+552|0,145784);a=K[b+584>>2]-L[d+18|0]|0;if((a|0)>0){tb(a,1)}K[b+56>>2]=K[b+620>>2];K[b+64>>2]=K[b+640>>2];K[b+76>>2]=K[b+636>>2];K[b+80>>2]=K[b+656>>2];K[b+92>>2]=K[b+596>>2]<<1;db(K[d+8>>2],0,b+48|0,d,e<<24>>31&5);break i;case 2:break m;default:break i}}i=K[d+8>>2]}j=L[d+3|0];K[b+88>>2]=0;K[b+92>>2]=0;K[b+80>>2]=0;K[b+84>>2]=0;K[b+72>>2]=0;K[b+76>>2]=0;K[m>>2]=0;K[m+4>>2]=0;K[b+56>>2]=0;K[b+60>>2]=0;K[b+48>>2]=0;K[b+52>>2]=0;bb(0,0,d,b+552|0,145784);a=K[b+628>>2];K[b+56>>2]=a;K[b+92>>2]=K[b+596>>2]<<1;O:{P:{if(a){g=0;e=u;c=t;if(!(L[b+552|0]&2)){break P}}Q:{if(!L[f+17|0]){g=0;break Q}g=0;bb(0,0,f,b+400|0,0);a=K[b+476>>2];K[b+56>>2]=a;if(!(!a|!(L[b+400|0]&2))){K[b+72>>2]=K[b+496>>2];g=1}c=K[b+512>>2];K[b+84>>2]=K[b+508>>2];K[b+88>>2]=c}if(a){break O}K[b+48>>2]=1;K[b+52>>2]=1;e=w;c=v}K[c>>2]=K[e>>2]}K[b+64>>2]=K[b+640>>2];c=L[d+16|0];a=0;e=L[d+7|0];R:{if(!e){c=K[(c<<2)+129280>>2];break R}ud(e,b+96|0);c=wd(K[b+220>>2]);e=K[b+224>>2];if((e|0)<=0){break R}a=wd(e)}if(K[36455]==K[36454]){K[36455]=K[50758]}e=j&15;e=e>>>0<2?1:e>>>0>6?3:2;S:{T:{switch(L[f+17|0]-3|0){case 2:case 4:g=L[d+19|0];f=K[50758];K[36425]=f;K[36441]=0;f=(f<<4)+216192|0;K[f+12>>2]=g;K[f+8>>2]=a;K[f>>2]=8;K[f+4>>2]=0;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0;g=L[d+22|0];f=L[d+21|0];a=K[36440];U:{if((a|0)<=0){break U}j=K[36424];if((j|0)<0){break U}j=(j<<4)+216192|0;if(K[j+4>>2]){break U}K[j+4>>2]=a}a=K[50758];K[36424]=a;K[36440]=0;a=(a<<4)+216192|0;K[a>>2]=9;K[a+4>>2]=0;g=g|f<<16;f=(f|0)==255;K[a+12>>2]=f?3604556:g;K[a+8>>2]=f?l:c;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0;db(i,1,b+48|0,d,e);break S;case 0:case 5:g=L[d+19|0];f=K[50758];K[36425]=f;K[36441]=0;f=(f<<4)+216192|0;K[f+12>>2]=g;K[f+8>>2]=a;K[f>>2]=8;K[f+4>>2]=0;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0;db(i,1,b+48|0,d,e);g=L[d+22|0];f=L[d+21|0];a=K[36440];V:{if((a|0)<=0){break V}j=K[36424];if((j|0)<0){break V}j=(j<<4)+216192|0;if(K[j+4>>2]){break V}K[j+4>>2]=a}a=K[50758];K[36424]=a;K[36440]=0;a=(a<<4)+216192|0;K[a>>2]=9;K[a+4>>2]=0;g=g|f<<16;f=(f|0)==255;K[a+12>>2]=f?3604556:g;K[a+8>>2]=f?l:c;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0;break S;default:break T}}if(g){g=L[d+22|0];f=K[36440];W:{if((f|0)<=0){break W}j=K[36424];if((j|0)<0){break W}j=(j<<4)+216192|0;if(K[j+4>>2]){break W}K[j+4>>2]=f}f=K[50758];K[36424]=f;K[36440]=0;f=(f<<4)+216192|0;K[f>>2]=9;K[f+4>>2]=0;K[f+12>>2]=(g|g<<16)-983040;K[f+8>>2]=s;f=K[50758]+1|0;K[50758]=(f|0)<=169?f:0;g=L[d+19|0];f=K[50758];K[36425]=f;K[36441]=0;f=(f<<4)+216192|0;K[f>>2]=8;K[f+4>>2]=0;K[f+12>>2]=g-1;K[f+8>>2]=a;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0;db(i,1,b+48|0,d,e);f=L[d+21|0];g=L[d+22|0];a=K[36440];X:{if((a|0)<=0){break X}j=K[36424];if((j|0)<0){break X}j=(j<<4)+216192|0;if(K[j+4>>2]){break X}K[j+4>>2]=a}a=K[50758];K[36424]=a;K[36440]=0;a=(a<<4)+216192|0;K[a>>2]=9;K[a+4>>2]=0;g=g|f<<16;f=(f|0)==255;K[a+12>>2]=f?3604556:g;K[a+8>>2]=f?l:c;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0;break S}if(!(I[d|0]&1)){g=L[d+19|0];f=K[50758];K[36425]=f;K[36441]=0;f=(f<<4)+216192|0;K[f+12>>2]=g;K[f+8>>2]=a;K[f>>2]=8;K[f+4>>2]=0;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0;g=L[d+22|0];f=L[d+21|0];a=K[36440];Y:{if((a|0)<=0){break Y}j=K[36424];if((j|0)<0){break Y}j=(j<<4)+216192|0;if(K[j+4>>2]){break Y}K[j+4>>2]=a}a=K[50758];K[36424]=a;K[36440]=0;a=(a<<4)+216192|0;K[a>>2]=9;K[a+4>>2]=0;g=g|f<<16;f=(f|0)==255;K[a+12>>2]=f?3604556:g;K[a+8>>2]=f?l:c;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0}db(i,1,b+48|0,d,e)}Z:{if(!K[47198]|k^1){break Z}Eb(b+704|0,K[d+8>>2],d,o,0);a=K[50757]-K[50758]|0;if((((a|0)<=0?a+170|0:a)|0)<6){break Z}c=K[36445];a=(K[50758]<<4)+216192|0;K[a>>2]=1802;K[a+4>>2]=c&16777215;c=K[b+708>>2];K[a+8>>2]=K[b+704>>2];K[a+12>>2]=c;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0}K[b+56>>2]=K[b+620>>2];K[b+84>>2]=0;K[b+88>>2]=0;K[b+64>>2]=K[b+640>>2];c=K[b+632>>2];K[b+68>>2]=c;a=r;_:{if(!c){if(!L[h+17|0]){break _}K[b+72>>2]=0;bb(0,0,h,b+248|0,0);K[b+52>>2]=1;a=K[b+368>>2];K[b+84>>2]=K[b+364>>2];K[b+88>>2]=a;c=K[b+328>>2];K[b+68>>2]=c;a=q;if(!c){break _}}K[b+72>>2]=K[a>>2]}db(i,2,b+48|0,d,e)}a=K[36442]+1|0;K[36442]=a;if((a|0)>997){break c}if(K[36423]>(a|0)){continue}break}}a=K[36440];$:{if((a|0)<=0){break $}c=K[36424];if((c|0)<0){break $}c=(c<<4)+216192|0;if(!K[c+4>>2]){K[c+4>>2]=a}K[36440]=0}K[36426]=0;K[36439]=-1;K[36455]=K[50758];Nb();K[36427]=-1;a=0;if(K[36423]<=0){break b}c=K[47568];e=K[33284];a=K[50757]-K[50758]|0;if((((a|0)<=0?a+170|0:a)|0)>=6){a=(K[50758]<<4)+216192|0;K[a>>2]=1290;K[a+8>>2]=c;K[a+4>>2]=e&16777215;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0}K[36423]=0;a=0}sa=b+720|0;return a}function be(a,b,c,d){var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,y=0,z=0,A=0,B=0,C=0,D=0,F=0;p=sa-48|0;sa=p;a:{if(c>>>0<=2){c=c<<2;A=K[c+124732>>2];B=K[c+124720>>2];while(1){c=K[b+4>>2];b:{if((c|0)!=K[b+104>>2]){K[b+4>>2]=c+1;c=L[c|0];break b}c=Ia(b)}if((c|0)==32|c-9>>>0<5){continue}break}m=1;c:{d:{switch(c-43|0){case 0:case 2:break d;default:break c}}m=(c|0)==45?-1:1;c=K[b+4>>2];if((c|0)!=K[b+104>>2]){K[b+4>>2]=c+1;c=L[c|0];break c}c=Ia(b)}e:{f:{while(1){if(I[g+84056|0]==(c|32)){g:{if(g>>>0>6){break g}c=K[b+4>>2];if((c|0)!=K[b+104>>2]){K[b+4>>2]=c+1;c=L[c|0];break g}c=Ia(b)}g=g+1|0;if((g|0)!=8){continue}break f}break}if((g|0)!=3){if((g|0)==8){break f}if(!d|g>>>0<4){break e}if((g|0)==8){break f}}c=K[b+116>>2];if((c|0)>0|(c|0)>=0){K[b+4>>2]=K[b+4>>2]-1}if(!d|g>>>0<4){break f}c=(c|0)<0;while(1){if(!c){K[b+4>>2]=K[b+4>>2]-1}g=g-1|0;if(g>>>0>3){continue}break}}k=sa-16|0;sa=k;h=(E(R(R(m|0)*R(Infinity))),x(2));b=h&2147483647;h:{if(b-8388608>>>0<=2130706431){c=b;b=b>>>7|0;c=c<<25;d=b+1065353216|0;break h}c=h<<25;d=h>>>7|2147418112;if(b>>>0>=2139095040){break h}c=0;d=0;if(!b){break h}c=b;b=T(b);Xa(k,c,0,0,0,b+81|0);j=K[k>>2];i=K[k+4>>2];c=K[k+8>>2];d=K[k+12>>2]^65536|16265-b<<16}K[p>>2]=j;K[p+4>>2]=i;K[p+8>>2]=c;K[p+12>>2]=h&-2147483648|d;sa=k+16|0;j=K[p+8>>2];i=K[p+12>>2];h=K[p>>2];l=K[p+4>>2];break a}i:{j:{k:{if(g){break k}g=0;while(1){if(I[g+84473|0]!=(c|32)){break k}l:{if(g>>>0>1){break l}c=K[b+4>>2];if((c|0)!=K[b+104>>2]){K[b+4>>2]=c+1;c=L[c|0];break l}c=Ia(b)}g=g+1|0;if((g|0)!=3){continue}break}break j}m:{switch(g|0){case 0:n:{if((c|0)!=48){break n}g=K[b+4>>2];o:{if((g|0)!=K[b+104>>2]){K[b+4>>2]=g+1;g=L[g|0];break o}g=Ia(b)}if((g&-33)==88){f=sa-432|0;sa=f;c=K[b+4>>2];p:{if((c|0)!=K[b+104>>2]){K[b+4>>2]=c+1;g=L[c|0];break p}g=Ia(b)}q:{r:{while(1){if((g|0)!=48){s:{if((g|0)!=46){break q}c=K[b+4>>2];if((c|0)==K[b+104>>2]){break s}K[b+4>>2]=c+1;g=L[c|0];break r}}else{c=K[b+4>>2];if((c|0)!=K[b+104>>2]){z=1;K[b+4>>2]=c+1;g=L[c|0]}else{z=1;g=Ia(b)}continue}break}g=Ia(b)}q=1;if((g|0)!=48){break q}while(1){c=r;r=c-1|0;s=s-!c|0;c=K[b+4>>2];t:{if((c|0)!=K[b+104>>2]){K[b+4>>2]=c+1;g=L[c|0];break t}g=Ia(b)}if((g|0)==48){continue}break}z=1}l=1073676288;while(1){u:{c=g|32;v:{w:{C=g-48|0;if(C>>>0<10){break w}if((g|0)!=46&c-97>>>0>=6){break u}if((g|0)!=46){break w}if(q){break u}q=1;r=j;s=i;break v}c=(g|0)>57?c-87|0:C;x:{if((i|0)<=0&j>>>0<=7|(i|0)<0){e=c+(e<<4)|0;break x}if(!i&j>>>0<=28){gb(f+48|0,c);Ja(f+32|0,w,y,h,l,0,0,0,1073414144);w=K[f+32>>2];y=K[f+36>>2];h=K[f+40>>2];l=K[f+44>>2];Ja(f+16|0,K[f+48>>2],K[f+52>>2],K[f+56>>2],K[f+60>>2],w,y,h,l);cb(f,K[f+16>>2],K[f+20>>2],K[f+24>>2],K[f+28>>2],k,o,u,v);u=K[f+8>>2];v=K[f+12>>2];k=K[f>>2];o=K[f+4>>2];break x}if(n|!c){break x}Ja(f+80|0,w,y,h,l,0,0,0,1073610752);cb(f- -64|0,K[f+80>>2],K[f+84>>2],K[f+88>>2],K[f+92>>2],k,o,u,v);u=K[f+72>>2];v=K[f+76>>2];n=1;k=K[f+64>>2];o=K[f+68>>2]}j=j+1|0;i=j?i:i+1|0;z=1}c=K[b+4>>2];if((c|0)!=K[b+104>>2]){K[b+4>>2]=c+1;g=L[c|0]}else{g=Ia(b)}continue}break}y:{if(!z){c=K[b+116>>2];z:{A:{if((c|0)>0|(c|0)>=0){c=K[b+4>>2];K[b+4>>2]=c-1;if(!d){break A}K[b+4>>2]=c-2;if(!q){break z}K[b+4>>2]=c-3;break z}if(d){break z}}lb(b,0,0)}rb(f+96|0,+(m|0)*0);k=K[f+96>>2];o=K[f+100>>2];c=K[f+108>>2];b=K[f+104>>2];break y}if((i|0)<=0&j>>>0<=7|(i|0)<0){h=j;l=i;while(1){e=e<<4;h=h+1|0;l=h?l:l+1|0;if((h|0)!=8|l){continue}break}}B:{C:{D:{if((g&-33)==80){h=ae(b,d);c=va;l=c;if(h|(c|0)!=-2147483648){break B}if(d){c=K[b+116>>2];if((c|0)>0|(c|0)>=0){break D}break C}k=0;o=0;lb(b,0,0);c=0;b=0;break y}h=0;l=0;if(K[b+116>>2]<0){break B}}K[b+4>>2]=K[b+4>>2]-1}h=0;l=0}if(!e){rb(f+112|0,+(m|0)*0);k=K[f+112>>2];o=K[f+116>>2];c=K[f+124>>2];b=K[f+120>>2];break y}b=q?r:j;i=(q?s:i)<<2|b>>>30;c=h+(b<<2)|0;b=i+l|0;j=c-32|0;i=(c>>>0<h>>>0?b+1|0:b)-(c>>>0<32)|0;b=i;if(j>>>0>0-A>>>0&(b|0)>=0|(b|0)>0){K[56798]=68;gb(f+160|0,m);Ja(f+144|0,K[f+160>>2],K[f+164>>2],K[f+168>>2],K[f+172>>2],-1,-1,-1,2147418111);Ja(f+128|0,K[f+144>>2],K[f+148>>2],K[f+152>>2],K[f+156>>2],-1,-1,-1,2147418111);k=K[f+128>>2];o=K[f+132>>2];c=K[f+140>>2];b=K[f+136>>2];break y}b=A-226|0;c=b>>31;if((i|0)>=(c|0)&b>>>0<=j>>>0|(c|0)<(i|0)){if((e|0)>=0){while(1){cb(f+416|0,k,o,u,v,0,0,0,-1073807360);b=Vd(k,o,u,v,1073610752);c=(b|0)>=0;b=c;cb(f+400|0,k,o,u,v,b?K[f+416>>2]:k,b?K[f+420>>2]:o,b?K[f+424>>2]:u,b?K[f+428>>2]:v);b=j;j=b-1|0;i=i-!b|0;u=K[f+408>>2];v=K[f+412>>2];k=K[f+400>>2];o=K[f+404>>2];e=c|e<<1;if((e|0)>=0){continue}break}}b=i-((A>>31)+(j>>>0<A>>>0)|0)|0;c=(j-A|0)+32|0;b=c>>>0<32?b+1|0:b;c=c>>>0<B>>>0&(b|0)<=0|(b|0)<0?(c|0)>0?c:0:B;E:{if((c|0)>=113){gb(f+384|0,m);r=K[f+392>>2];s=K[f+396>>2];w=K[f+384>>2];y=K[f+388>>2];h=0;b=0;break E}rb(f+352|0,Ib(1,144-c|0));gb(f+336|0,m);w=K[f+336>>2];y=K[f+340>>2];r=K[f+344>>2];s=K[f+348>>2];ee(f+368|0,K[f+352>>2],K[f+356>>2],K[f+360>>2],K[f+364>>2],w,y,r,s);t=K[f+376>>2];D=K[f+380>>2];h=K[f+372>>2];b=K[f+368>>2]}d=!(e&1)&((Gb(k,o,u,v,0,0,0,0)|0)!=0&(c|0)<32);Tb(f+320|0,d+e|0);Ja(f+304|0,w,y,r,s,K[f+320>>2],K[f+324>>2],K[f+328>>2],K[f+332>>2]);c=b;cb(f+272|0,K[f+304>>2],K[f+308>>2],K[f+312>>2],K[f+316>>2],b,h,t,D);b=d;Ja(f+288|0,w,y,r,s,b?0:k,b?0:o,b?0:u,b?0:v);cb(f+256|0,K[f+288>>2],K[f+292>>2],K[f+296>>2],K[f+300>>2],K[f+272>>2],K[f+276>>2],K[f+280>>2],K[f+284>>2]);Xc(f+240|0,K[f+256>>2],K[f+260>>2],K[f+264>>2],K[f+268>>2],c,h,t,D);b=K[f+240>>2];d=K[f+244>>2];c=K[f+248>>2];h=K[f+252>>2];if(!Gb(b,d,c,h,0,0,0,0)){K[56798]=68}de(f+224|0,b,d,c,h,j);k=K[f+224>>2];o=K[f+228>>2];c=K[f+236>>2];b=K[f+232>>2];break y}K[56798]=68;gb(f+208|0,m);Ja(f+192|0,K[f+208>>2],K[f+212>>2],K[f+216>>2],K[f+220>>2],0,0,0,65536);Ja(f+176|0,K[f+192>>2],K[f+196>>2],K[f+200>>2],K[f+204>>2],0,0,0,65536);k=K[f+176>>2];o=K[f+180>>2];c=K[f+188>>2];b=K[f+184>>2]}K[p+16>>2]=k;K[p+20>>2]=o;K[p+24>>2]=b;K[p+28>>2]=c;sa=f+432|0;j=K[p+24>>2];i=K[p+28>>2];h=K[p+16>>2];l=K[p+20>>2];break a}if(K[b+116>>2]<0){break n}K[b+4>>2]=K[b+4>>2]-1}g=b;t=m;f=d;b=0;m=0;e=sa-8976|0;sa=e;C=0-A|0;D=C-B|0;F:{G:{while(1){if((c|0)!=48){H:{if((c|0)!=46){break F}c=K[g+4>>2];if((c|0)==K[g+104>>2]){break H}K[g+4>>2]=c+1;c=L[c|0];break G}}else{b=K[g+4>>2];if((b|0)!=K[g+104>>2]){K[g+4>>2]=b+1;c=L[b|0]}else{c=Ia(g)}b=1;continue}break}c=Ia(g)}n=1;if((c|0)!=48){break F}while(1){b=j;j=b-1|0;i=i-!b|0;b=K[g+4>>2];I:{if((b|0)!=K[g+104>>2]){K[g+4>>2]=b+1;c=L[b|0];break I}c=Ia(g)}if((c|0)==48){continue}break}b=1}K[e+784>>2]=0;J:{K:{d=(c|0)==46;k=c-48|0;L:{M:{N:{if(d|k>>>0<=9){while(1){O:{if(d&1){if(!n){j=h;i=l;n=1;break O}d=!b;break N}h=h+1|0;l=h?l:l+1|0;if((m|0)<=2044){z=(c|0)==48?z:h;b=(e+784|0)+(m<<2)|0;if(q){k=(Q(K[b>>2],10)+c|0)-48|0}K[b>>2]=k;b=1;d=q+1|0;c=(d|0)==9;q=c?0:d;m=c+m|0;break O}if((c|0)==48){break O}K[e+8960>>2]=K[e+8960>>2]|1;z=18396}c=K[g+4>>2];P:{if((c|0)!=K[g+104>>2]){K[g+4>>2]=c+1;c=L[c|0];break P}c=Ia(g)}d=(c|0)==46;k=c-48|0;if(d|k>>>0<10){continue}break}}j=n?j:h;i=n?i:l;if(!(!b|(c&-33)!=69)){k=ae(g,f);b=va;o=b;Q:{if(k|(b|0)!=-2147483648){break Q}if(!f){break L}k=0;o=0;if(K[g+116>>2]<0){break Q}K[g+4>>2]=K[g+4>>2]-1}i=i+o|0;j=j+k|0;i=j>>>0<k>>>0?i+1|0:i;break K}d=!b;if((c|0)<0){break M}}if(K[g+116>>2]<0){break M}K[g+4>>2]=K[g+4>>2]-1}if(!d){break K}K[56798]=28}h=0;l=0;lb(g,0,0);c=0;b=0;break J}b=K[e+784>>2];if(!b){rb(e,+(t|0)*0);h=K[e>>2];l=K[e+4>>2];c=K[e+12>>2];b=K[e+8>>2];break J}if(!(h>>>0>9&(l|0)>=0|(l|0)>0|((h|0)!=(j|0)|(i|0)!=(l|0))|(b>>>B|0?(B|0)<=30:0))){gb(e+48|0,t);Tb(e+32|0,b);Ja(e+16|0,K[e+48>>2],K[e+52>>2],K[e+56>>2],K[e+60>>2],K[e+32>>2],K[e+36>>2],K[e+40>>2],K[e+44>>2]);h=K[e+16>>2];l=K[e+20>>2];c=K[e+28>>2];b=K[e+24>>2];break J}if(j>>>0>C>>>1>>>0&(i|0)>=0|(i|0)>0){K[56798]=68;gb(e+96|0,t);Ja(e+80|0,K[e+96>>2],K[e+100>>2],K[e+104>>2],K[e+108>>2],-1,-1,-1,2147418111);Ja(e- -64|0,K[e+80>>2],K[e+84>>2],K[e+88>>2],K[e+92>>2],-1,-1,-1,2147418111);h=K[e+64>>2];l=K[e+68>>2];c=K[e+76>>2];b=K[e+72>>2];break J}b=A-226|0;c=j>>>0<b>>>0;b=b>>31;if(c&(i|0)<=(b|0)|(b|0)>(i|0)){K[56798]=68;gb(e+144|0,t);Ja(e+128|0,K[e+144>>2],K[e+148>>2],K[e+152>>2],K[e+156>>2],0,0,0,65536);Ja(e+112|0,K[e+128>>2],K[e+132>>2],K[e+136>>2],K[e+140>>2],0,0,0,65536);h=K[e+112>>2];l=K[e+116>>2];c=K[e+124>>2];b=K[e+120>>2];break J}if(q){if((q|0)<=8){b=(e+784|0)+(m<<2)|0;g=K[b>>2];while(1){g=Q(g,10);q=q+1|0;if((q|0)!=9){continue}break}K[b>>2]=g}m=m+1|0}R:{n=j;if((z|0)>(j|0)|(z|0)>=9|(j|0)>17){break R}if((n|0)==9){gb(e+192|0,t);Tb(e+176|0,K[e+784>>2]);Ja(e+160|0,K[e+192>>2],K[e+196>>2],K[e+200>>2],K[e+204>>2],K[e+176>>2],K[e+180>>2],K[e+184>>2],K[e+188>>2]);h=K[e+160>>2];l=K[e+164>>2];c=K[e+172>>2];b=K[e+168>>2];break J}if((n|0)<=8){gb(e+272|0,t);Tb(e+256|0,K[e+784>>2]);Ja(e+240|0,K[e+272>>2],K[e+276>>2],K[e+280>>2],K[e+284>>2],K[e+256>>2],K[e+260>>2],K[e+264>>2],K[e+268>>2]);gb(e+224|0,K[(0-n<<2)+124720>>2]);Ud(e+208|0,K[e+240>>2],K[e+244>>2],K[e+248>>2],K[e+252>>2],K[e+224>>2],K[e+228>>2],K[e+232>>2],K[e+236>>2]);h=K[e+208>>2];l=K[e+212>>2];c=K[e+220>>2];b=K[e+216>>2];break J}b=(Q(n,-3)+B|0)+27|0;c=K[e+784>>2];if(c>>>b|0?(b|0)<=30:0){break R}gb(e+352|0,t);Tb(e+336|0,c);Ja(e+320|0,K[e+352>>2],K[e+356>>2],K[e+360>>2],K[e+364>>2],K[e+336>>2],K[e+340>>2],K[e+344>>2],K[e+348>>2]);gb(e+304|0,K[(n<<2)+124648>>2]);Ja(e+288|0,K[e+320>>2],K[e+324>>2],K[e+328>>2],K[e+332>>2],K[e+304>>2],K[e+308>>2],K[e+312>>2],K[e+316>>2]);h=K[e+288>>2];l=K[e+292>>2];c=K[e+300>>2];b=K[e+296>>2];break J}while(1){c=m;m=c-1|0;if(!K[(e+784|0)+(m<<2)>>2]){continue}break}q=0;b=(n|0)%9|0;S:{if(!b){d=0;break S}d=0;b=(n|0)<0?b+9|0:b;T:{if(!c){c=0;break T}j=K[(0-b<<2)+124720>>2];i=1e9/(j|0)|0;k=0;g=0;while(1){h=k;k=(e+784|0)+(g<<2)|0;l=K[k>>2];m=(l>>>0)/(j>>>0)|0;h=h+m|0;K[k>>2]=h;h=!h&(d|0)==(g|0);d=h?d+1&2047:d;n=h?n-9|0:n;k=Q(i,l-Q(j,m)|0);g=g+1|0;if((g|0)!=(c|0)){continue}break}if(!k){break T}K[(e+784|0)+(c<<2)>>2]=k;c=c+1|0}n=(n-b|0)+9|0}while(1){g=(e+784|0)+(d<<2)|0;U:{while(1){if(((n|0)!=36|N[g>>2]>=10384593)&(n|0)>=36){break U}m=c+2047|0;k=0;b=c;while(1){c=b;h=m&2047;m=(e+784|0)+(h<<2)|0;b=K[m>>2];l=b>>>3|0;j=k;k=b<<29;j=j+k|0;b=l;i=j>>>0<k>>>0?b+1|0:b;if(!i&j>>>0<1000000001){k=0}else{b=j;k=wg(b,i,1e9);j=b-vg(k,va,1e9,0)|0}K[m>>2]=j;b=(h|0)!=(c-1&2047)?c:(d|0)==(h|0)?c:j?c:h;m=h-1|0;if((d|0)!=(h|0)){continue}break}q=q-29|0;if(!k){continue}break}d=d-1&2047;if((d|0)==(b|0)){j=e+784|0;c=j+((b+2046&2047)<<2)|0;g=c;i=K[c>>2];c=b-1&2047;K[g>>2]=i|K[j+(c<<2)>>2]}n=n+9|0;K[(e+784|0)+(d<<2)>>2]=k;continue}break}V:{W:while(1){j=c+1&2047;k=(e+784|0)+((c-1&2047)<<2)|0;while(1){h=(n|0)>45?9:1;X:{while(1){b=d;g=0;Y:{while(1){Z:{d=b+g&2047;if((d|0)==(c|0)){break Z}d=K[(e+784|0)+(d<<2)>>2];i=K[(g<<2)+124672>>2];if(d>>>0<i>>>0){break Z}if(d>>>0>i>>>0){break Y}g=g+1|0;if((g|0)!=4){continue}}break}if((n|0)!=36){break Y}j=0;i=0;g=0;h=0;l=0;while(1){d=b+g&2047;if((d|0)==(c|0)){c=c+1&2047;K[(e+(c<<2)|0)+780>>2]=0}Tb(e+768|0,K[(e+784|0)+(d<<2)>>2]);Ja(e+752|0,j,i,h,l,0,0,1342177280,1075633366);cb(e+736|0,K[e+752>>2],K[e+756>>2],K[e+760>>2],K[e+764>>2],K[e+768>>2],K[e+772>>2],K[e+776>>2],K[e+780>>2]);h=K[e+744>>2];l=K[e+748>>2];j=K[e+736>>2];i=K[e+740>>2];g=g+1|0;if((g|0)!=4){continue}break}gb(e+720|0,t);Ja(e+704|0,j,i,h,l,K[e+720>>2],K[e+724>>2],K[e+728>>2],K[e+732>>2]);h=K[e+712>>2];l=K[e+716>>2];j=0;i=0;k=K[e+704>>2];o=K[e+708>>2];f=q+113|0;g=f-A|0;m=(g|0)<(B|0);d=m?(g|0)>0?g:0:B;if((d|0)<=112){break X}break V}q=h+q|0;d=c;if((b|0)==(c|0)){continue}break}l=1e9>>>h|0;m=-1<<h^-1;g=0;d=b;while(1){i=g;g=(e+784|0)+(b<<2)|0;f=K[g>>2];i=i+(f>>>h|0)|0;K[g>>2]=i;i=!i&(b|0)==(d|0);d=i?d+1&2047:d;n=i?n-9|0:n;g=Q(l,f&m);b=b+1&2047;if((c|0)!=(b|0)){continue}break}if(!g){continue}if((d|0)!=(j|0)){K[(e+784|0)+(c<<2)>>2]=g;c=j;continue W}K[k>>2]=K[k>>2]|1;continue}break}break}rb(e+656|0,Ib(1,225-d|0));ee(e+688|0,K[e+656>>2],K[e+660>>2],K[e+664>>2],K[e+668>>2],k,o,h,l);w=K[e+696>>2];y=K[e+700>>2];u=K[e+688>>2];v=K[e+692>>2];rb(e+640|0,Ib(1,113-d|0));ce(e+672|0,k,o,h,l,K[e+640>>2],K[e+644>>2],K[e+648>>2],K[e+652>>2]);j=K[e+672>>2];i=K[e+676>>2];r=K[e+680>>2];s=K[e+684>>2];Xc(e+624|0,k,o,h,l,j,i,r,s);cb(e+608|0,u,v,w,y,K[e+624>>2],K[e+628>>2],K[e+632>>2],K[e+636>>2]);h=K[e+616>>2];l=K[e+620>>2];k=K[e+608>>2];o=K[e+612>>2]}n=b+4&2047;_:{if((n|0)==(c|0)){break _}n=K[(e+784|0)+(n<<2)>>2];$:{if(n>>>0<=499999999){if(!n&(b+5&2047)==(c|0)){break $}rb(e+496|0,+(t|0)*.25);cb(e+480|0,j,i,r,s,K[e+496>>2],K[e+500>>2],K[e+504>>2],K[e+508>>2]);r=K[e+488>>2];s=K[e+492>>2];j=K[e+480>>2];i=K[e+484>>2];break $}if((n|0)!=5e8){rb(e+592|0,+(t|0)*.75);cb(e+576|0,j,i,r,s,K[e+592>>2],K[e+596>>2],K[e+600>>2],K[e+604>>2]);r=K[e+584>>2];s=K[e+588>>2];j=K[e+576>>2];i=K[e+580>>2];break $}F=+(t|0);if((b+5&2047)==(c|0)){rb(e+528|0,F*.5);cb(e+512|0,j,i,r,s,K[e+528>>2],K[e+532>>2],K[e+536>>2],K[e+540>>2]);r=K[e+520>>2];s=K[e+524>>2];j=K[e+512>>2];i=K[e+516>>2];break $}rb(e+560|0,F*.75);cb(e+544|0,j,i,r,s,K[e+560>>2],K[e+564>>2],K[e+568>>2],K[e+572>>2]);r=K[e+552>>2];s=K[e+556>>2];j=K[e+544>>2];i=K[e+548>>2]}if((d|0)>111){break _}ce(e+464|0,j,i,r,s,0,0,0,1073676288);if(Gb(K[e+464>>2],K[e+468>>2],K[e+472>>2],K[e+476>>2],0,0,0,0)){break _}cb(e+448|0,j,i,r,s,0,0,0,1073676288);r=K[e+456>>2];s=K[e+460>>2];j=K[e+448>>2];i=K[e+452>>2]}cb(e+432|0,k,o,h,l,j,i,r,s);Xc(e+416|0,K[e+432>>2],K[e+436>>2],K[e+440>>2],K[e+444>>2],u,v,w,y);h=K[e+424>>2];l=K[e+428>>2];k=K[e+416>>2];o=K[e+420>>2];aa:{if((D-2|0)>=(f&2147483647)){break aa}K[e+408>>2]=h;K[e+412>>2]=l&2147483647;K[e+400>>2]=k;K[e+404>>2]=o;Ja(e+384|0,k,o,h,l,0,0,0,1073610752);b=Vd(K[e+400>>2],K[e+404>>2],K[e+408>>2],K[e+412>>2],1081081856);b=(b|0)>=0;h=b?K[e+392>>2]:h;l=b?K[e+396>>2]:l;k=b?K[e+384>>2]:k;o=b?K[e+388>>2]:o;q=b+q|0;if(!((Gb(j,i,r,s,0,0,0,0)|0)!=0&(b?m&(d|0)!=(g|0):m))&(q+110|0)<=(D|0)){break aa}K[56798]=68}de(e+368|0,k,o,h,l,q);h=K[e+368>>2];l=K[e+372>>2];c=K[e+380>>2];b=K[e+376>>2]}K[p+40>>2]=b;K[p+44>>2]=c;K[p+32>>2]=h;K[p+36>>2]=l;sa=e+8976|0;j=K[p+40>>2];i=K[p+44>>2];h=K[p+32>>2];l=K[p+36>>2];break a;case 3:break j;default:break m}}c=K[b+116>>2];if((c|0)>0|(c|0)>=0){K[b+4>>2]=K[b+4>>2]-1}break i}ba:{c=K[b+4>>2];ca:{if((c|0)!=K[b+104>>2]){K[b+4>>2]=c+1;c=L[c|0];break ca}c=Ia(b)}if((c|0)==40){g=1;break ba}i=2147450880;if(K[b+116>>2]<0){break a}K[b+4>>2]=K[b+4>>2]-1;break a}while(1){da:{c=K[b+4>>2];ea:{if((c|0)!=K[b+104>>2]){K[b+4>>2]=c+1;c=L[c|0];break ea}c=Ia(b)}if(!(c-48>>>0<10|c-65>>>0<26|(c|0)==95)){if(c-97>>>0>=26){break da}}g=g+1|0;continue}break}i=2147450880;if((c|0)==41){break a}c=K[b+116>>2];if((c|0)>0|(c|0)>=0){K[b+4>>2]=K[b+4>>2]-1}fa:{if(d){if(g){break fa}break a}break i}while(1){g=g-1|0;if((c|0)>0|(c|0)>=0){K[b+4>>2]=K[b+4>>2]-1}if(g){continue}break}break a}K[56798]=28;lb(b,0,0)}i=0}K[a>>2]=h;K[a+4>>2]=l;K[a+8>>2]=j;K[a+12>>2]=i;sa=p+48|0}function db(a,b,c,d,e){var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0;u=sa-112|0;sa=u;a:{if(!K[c+8>>2]){break a}z=K[50754]/70|0;k=K[d+12>>2];o=k?k:256;b:{if((b|0)==2){k=K[K[47192]+80>>2];if((k|0)<=0|!(L[d|0]&8|k>>>0<=L[a+14|0]|L[a+6|0]&32)){break b}z=z<<1;break b}if((b|0)!=1){break b}c:{if(L[a+11|0]==3){break c}switch(L[d-15|0]-3|0){case 0:case 5:break c;default:break b}}k=K[K[47192]+44>>2];o=(k|0)<(o|0)?o:k}K[36436]=0;r=a;A=b;j=d;n=sa-16|0;sa=n;a=K[34460]+K[c+8>>2]|0;b=L[a+2|0];b=b>>>0>=24?24:b;K[n+12>>2]=b;g=K[c+12>>2]+K[c+24>>2]|0;K[36422]=g;d:{if(!b){b=0;k=145488;break d}k=a+4|0;f=J[a+4>>1]&1;while(1){a=(i<<3)+145488|0;d=k+(f?i<<6:Q(i,44))|0;K[a+4>>2]=d;m=M[d>>1];J[a+2>>1]=m;J[a>>1]=L[d+16|0];h=m&2?i:h;i=i+1|0;if((i|0)!=(b|0)){continue}break}k=145488;if((h|0)<=0){break d}if((A|0)==1){b=h+1|0;K[n+12>>2]=b;k=145488;break d}b=b-h|0;K[n+12>>2]=b;k=(h<<3)+145488|0}if(!(!K[c+4>>2]|(K[c+20>>2]|L[r+11|0]!=2))){f=K[c+36>>2];d=K[c+40>>2];a=0;b=K[n+12>>2];if((b|0)>=2){h=f>>>12|0;m=d>>>26&7;s=d>>>18&248;q=d&63;p=Q(q,50);w=f>>>6|0;v=w&63;i=f<<1&126;x=Q(d>>>16&31,50)-750|0;y=Q(d>>>11&31,50)-750|0;t=Q(d>>>6&31,50)-750|0;e:{f:{if((A|0)==1){b=K[k+4>>2];g=J[b>>1];g:{if((g|0)<0){a=b;break g}d=K[44469]+1|0;d=(d|0)<=169?d:0;K[44469]=d;g=d<<6;d=g+177888|0;if(!d){break g}a=M[b+4>>1]|M[b+6>>1]<<16;l=M[b>>1]|M[b+2>>1]<<16;J[d>>1]=l;J[d+2>>1]=l>>>16;J[d+4>>1]=a;J[d+6>>1]=a>>>16;a=M[b+60>>1]|M[b+62>>1]<<16;l=M[b+56>>1]|M[b+58>>1]<<16;J[d+56>>1]=l;J[d+58>>1]=l>>>16;J[d+60>>1]=a;J[d+62>>1]=a>>>16;a=M[b+52>>1]|M[b+54>>1]<<16;l=M[b+48>>1]|M[b+50>>1]<<16;J[d+48>>1]=l;J[d+50>>1]=l>>>16;J[d+52>>1]=a;J[d+54>>1]=a>>>16;a=M[b+44>>1]|M[b+46>>1]<<16;l=M[b+40>>1]|M[b+42>>1]<<16;J[d+40>>1]=l;J[d+42>>1]=l>>>16;J[d+44>>1]=a;J[d+46>>1]=a>>>16;a=M[b+36>>1]|M[b+38>>1]<<16;l=M[b+32>>1]|M[b+34>>1]<<16;J[d+32>>1]=l;J[d+34>>1]=l>>>16;J[d+36>>1]=a;J[d+38>>1]=a>>>16;a=M[b+28>>1]|M[b+30>>1]<<16;l=M[b+24>>1]|M[b+26>>1]<<16;J[d+24>>1]=l;J[d+26>>1]=l>>>16;J[d+28>>1]=a;J[d+30>>1]=a>>>16;a=M[b+20>>1]|M[b+22>>1]<<16;l=M[b+16>>1]|M[b+18>>1]<<16;J[d+16>>1]=l;J[d+18>>1]=l>>>16;J[d+20>>1]=a;J[d+22>>1]=a>>>16;a=M[b+12>>1]|M[b+14>>1]<<16;b=M[b+8>>1]|M[b+10>>1]<<16;J[d+8>>1]=b;J[d+10>>1]=b>>>16;J[d+12>>1]=a;J[d+14>>1]=a>>>16;I[g+177904|0]=0;g=M[d>>1]|-32768;J[d>>1]=g;a=d}K[k+4>>2]=a;J[k>>1]=i?i:50;J[k+2>>1]=M[k+2>>1]|16384;J[a>>1]=g|16384;g=K[k+12>>2];b=L[g+17|0];d=K[32972];if(K[d+132>>2]){I[a+39|0]=L[g+39|0]-4}h:{if(q){if(f&2048){b=(Q(b,w&31)>>>0)/30|0;i:{if(K[d+132>>2]){break i}d=L[a+17|0];if(!d){break i}b=(b<<6>>>0)/(d>>>0)|0;b=J[(((b|0)>=199?199:b)<<1)+102896>>1];I[a+18|0]=(Q(b,L[a+18|0])|0)/512;I[a+19|0]=(Q(b,L[a+19|0])|0)/512;I[a+20|0]=(Q(b,L[a+20|0])|0)/512;I[a+21|0]=(Q(b,L[a+21|0])|0)/512;I[a+22|0]=(Q(b,L[a+22|0])|0)/512;I[a+23|0]=(Q(b,L[a+23|0])|0)/512;I[a+24|0]=(Q(b,L[a+24|0])|0)/512;I[a+25|0]=(Q(b,L[a+25|0])|0)/512}td(a,p,t,y,m,x,s,h);break h}td(a,p,t,y,m,x,s,h);if(K[K[32972]+132>>2]){break h}b=L[a+17|0];if(!b){break h}b=(v<<7>>>0)/(b>>>0)|0;b=J[(((b|0)>=199?199:b)<<1)+102896>>1];I[a+18|0]=(Q(b,L[a+18|0])|0)/512;I[a+19|0]=(Q(b,L[a+19|0])|0)/512;I[a+20|0]=(Q(b,L[a+20|0])|0)/512;I[a+21|0]=(Q(b,L[a+21|0])|0)/512;I[a+22|0]=(Q(b,L[a+22|0])|0)/512;I[a+23|0]=(Q(b,L[a+23|0])|0)/512;I[a+24|0]=(Q(b,L[a+24|0])|0)/512;I[a+25|0]=(Q(b,L[a+25|0])|0)/512;break h}d=K[d+132>>2];if(h&8){if(d){break h}d=L[a+17|0];if(!d){break h}b=((Q(b,48)&16320)>>>0)/(d>>>0)|0;b=J[((b>>>0>=199?199:b)<<1)+102896>>1];I[a+18|0]=(Q(b,L[a+18|0])|0)/512;I[a+19|0]=(Q(b,L[a+19|0])|0)/512;I[a+20|0]=(Q(b,L[a+20|0])|0)/512;I[a+21|0]=(Q(b,L[a+21|0])|0)/512;I[a+22|0]=(Q(b,L[a+22|0])|0)/512;I[a+23|0]=(Q(b,L[a+23|0])|0)/512;I[a+24|0]=(Q(b,L[a+24|0])|0)/512;I[a+25|0]=(Q(b,L[a+25|0])|0)/512;break h}if(d){break h}b=L[a+17|0];if(!b){break h}b=1792/(b>>>0)|0;b=J[((b>>>0>=199?199:b)<<1)+102896>>1];I[a+18|0]=(Q(b,L[a+18|0])|0)/512;I[a+19|0]=(Q(b,L[a+19|0])|0)/512;I[a+20|0]=(Q(b,L[a+20|0])|0)/512;I[a+21|0]=(Q(b,L[a+21|0])|0)/512;I[a+22|0]=(Q(b,L[a+22|0])|0)/512;I[a+23|0]=(Q(b,L[a+23|0])|0)/512;I[a+24|0]=(Q(b,L[a+24|0])|0)/512;I[a+25|0]=(Q(b,L[a+25|0])|0)/512}if(!(h&8)){break f}d=J[a+4>>1];b=2816;j:{if((d|0)<300){break j}b=2560;if(d>>>0<400){break j}b=d>>>0<500?2304:2048}K[36436]=b;break f}if(!(h|q)){break e}k:{if(h&8){g=b-1|0;b=K[(k+(g<<3)|0)+4>>2];l:{if(J[b>>1]<0){a=b;break l}a=K[44469]+1|0;a=(a|0)<=169?a:0;K[44469]=a;g=M[b+20>>1]|M[b+22>>1]<<16;a=(a<<6)+177888|0;f=M[b+16>>1]|M[b+18>>1]<<16;J[a+16>>1]=f;J[a+18>>1]=f>>>16;J[a+20>>1]=g;J[a+22>>1]=g>>>16;g=M[b+4>>1]|M[b+6>>1]<<16;f=M[b>>1]|M[b+2>>1]<<16;J[a>>1]=f;J[a+2>>1]=f>>>16;J[a+4>>1]=g;J[a+6>>1]=g>>>16;g=M[b+12>>1]|M[b+14>>1]<<16;f=M[b+8>>1]|M[b+10>>1]<<16;J[a+8>>1]=f;J[a+10>>1]=f>>>16;J[a+12>>1]=g;J[a+14>>1]=g>>>16;g=M[b+28>>1]|M[b+30>>1]<<16;f=M[b+24>>1]|M[b+26>>1]<<16;J[a+24>>1]=f;J[a+26>>1]=f>>>16;J[a+28>>1]=g;J[a+30>>1]=g>>>16;g=M[b+36>>1]|M[b+38>>1]<<16;f=M[b+32>>1]|M[b+34>>1]<<16;J[a+32>>1]=f;J[a+34>>1]=f>>>16;J[a+36>>1]=g;J[a+38>>1]=g>>>16;g=M[b+44>>1]|M[b+46>>1]<<16;f=M[b+40>>1]|M[b+42>>1]<<16;J[a+40>>1]=f;J[a+42>>1]=f>>>16;J[a+44>>1]=g;J[a+46>>1]=g>>>16;g=M[b+52>>1]|M[b+54>>1]<<16;f=M[b+48>>1]|M[b+50>>1]<<16;J[a+48>>1]=f;J[a+50>>1]=f>>>16;J[a+52>>1]=g;J[a+54>>1]=g>>>16;g=M[b+60>>1]|M[b+62>>1]<<16;b=M[b+56>>1]|M[b+58>>1]<<16;J[a+56>>1]=b;J[a+58>>1]=b>>>16;J[a+60>>1]=g;J[a+62>>1]=g>>>16;I[a+16|0]=0;J[a>>1]=M[a>>1]|32768;g=K[n+12>>2]-1|0}K[(k+(g<<3)|0)+4>>2]=a;g=J[a+4>>1];b=1792;m:{if((g|0)<300){break m}b=1536;if(g>>>0<400){break m}b=g>>>0<500?1280:1024}K[36436]=b;f=35;break k}K[n+12>>2]=b+1;g=k+(b<<3)|0;a=g-8|0;J[a>>1]=i;b=K[a+4>>2];a=K[44469]+1|0;a=(a|0)<=169?a:0;K[44469]=a;w=a<<6;a=w+177888|0;if(a){f=M[b+4>>1]|M[b+6>>1]<<16;l=M[b>>1]|M[b+2>>1]<<16;J[a>>1]=l;J[a+2>>1]=l>>>16;J[a+4>>1]=f;J[a+6>>1]=f>>>16;f=M[b+60>>1]|M[b+62>>1]<<16;l=M[b+56>>1]|M[b+58>>1]<<16;J[a+56>>1]=l;J[a+58>>1]=l>>>16;J[a+60>>1]=f;J[a+62>>1]=f>>>16;f=M[b+52>>1]|M[b+54>>1]<<16;l=M[b+48>>1]|M[b+50>>1]<<16;J[a+48>>1]=l;J[a+50>>1]=l>>>16;J[a+52>>1]=f;J[a+54>>1]=f>>>16;f=M[b+44>>1]|M[b+46>>1]<<16;l=M[b+40>>1]|M[b+42>>1]<<16;J[a+40>>1]=l;J[a+42>>1]=l>>>16;J[a+44>>1]=f;J[a+46>>1]=f>>>16;f=M[b+36>>1]|M[b+38>>1]<<16;l=M[b+32>>1]|M[b+34>>1]<<16;J[a+32>>1]=l;J[a+34>>1]=l>>>16;J[a+36>>1]=f;J[a+38>>1]=f>>>16;f=M[b+28>>1]|M[b+30>>1]<<16;l=M[b+24>>1]|M[b+26>>1]<<16;J[a+24>>1]=l;J[a+26>>1]=l>>>16;J[a+28>>1]=f;J[a+30>>1]=f>>>16;f=M[b+20>>1]|M[b+22>>1]<<16;l=M[b+16>>1]|M[b+18>>1]<<16;J[a+16>>1]=l;J[a+18>>1]=l>>>16;J[a+20>>1]=f;J[a+22>>1]=f>>>16;f=M[b+12>>1]|M[b+14>>1]<<16;b=M[b+8>>1]|M[b+10>>1]<<16;J[a+8>>1]=b;J[a+10>>1]=b>>>16;J[a+12>>1]=f;J[a+14>>1]=f>>>16;I[w+177904|0]=0;J[a>>1]=M[a>>1]|32768}J[g>>1]=0;K[g+4>>2]=a;if(i>>>0>=37){K[36422]=(i+K[36422]|0)-36}f=v<<1;if(!q){break k}td(a,p,t,y,m,x,s,h)}n:{if(K[K[32972]+132>>2]){break n}b=L[a+17|0];if(!b){break n}b=(f<<6>>>0)/(b>>>0)|0;b=J[(((b|0)>=199?199:b)<<1)+102896>>1];I[a+18|0]=(Q(b,L[a+18|0])|0)/512;I[a+19|0]=(Q(b,L[a+19|0])|0)/512;I[a+20|0]=(Q(b,L[a+20|0])|0)/512;I[a+21|0]=(Q(b,L[a+21|0])|0)/512;I[a+22|0]=(Q(b,L[a+22|0])|0)/512;I[a+23|0]=(Q(b,L[a+23|0])|0)/512;I[a+24|0]=(Q(b,L[a+24|0])|0)/512;I[a+25|0]=(Q(b,L[a+25|0])|0)/512}if(d-536870912>>>0<=1073741823){m=K[44469];g=K[n+12>>2];if((g|0)>0){a=Q(d>>>29|0,10)+102854|0;s=J[a+4>>1];q=J[a+2>>1];p=J[a>>1];x=J[a+6>>1];y=J[a+8>>1];f=0;while(1){t=k+(f<<3)|0;b=K[t+4>>2];o:{if(J[b>>1]<0){a=b;break o}a=m+1|0;m=(a|0)<=169?a:0;v=m<<6;a=v+177888|0;if(!a){a=0;break o}d=M[b+4>>1]|M[b+6>>1]<<16;g=M[b>>1]|M[b+2>>1]<<16;J[a>>1]=g;J[a+2>>1]=g>>>16;J[a+4>>1]=d;J[a+6>>1]=d>>>16;d=M[b+60>>1]|M[b+62>>1]<<16;g=M[b+56>>1]|M[b+58>>1]<<16;J[a+56>>1]=g;J[a+58>>1]=g>>>16;J[a+60>>1]=d;J[a+62>>1]=d>>>16;d=M[b+52>>1]|M[b+54>>1]<<16;g=M[b+48>>1]|M[b+50>>1]<<16;J[a+48>>1]=g;J[a+50>>1]=g>>>16;J[a+52>>1]=d;J[a+54>>1]=d>>>16;d=M[b+44>>1]|M[b+46>>1]<<16;g=M[b+40>>1]|M[b+42>>1]<<16;J[a+40>>1]=g;J[a+42>>1]=g>>>16;J[a+44>>1]=d;J[a+46>>1]=d>>>16;d=M[b+36>>1]|M[b+38>>1]<<16;g=M[b+32>>1]|M[b+34>>1]<<16;J[a+32>>1]=g;J[a+34>>1]=g>>>16;J[a+36>>1]=d;J[a+38>>1]=d>>>16;d=M[b+28>>1]|M[b+30>>1]<<16;g=M[b+24>>1]|M[b+26>>1]<<16;J[a+24>>1]=g;J[a+26>>1]=g>>>16;J[a+28>>1]=d;J[a+30>>1]=d>>>16;d=M[b+20>>1]|M[b+22>>1]<<16;g=M[b+16>>1]|M[b+18>>1]<<16;J[a+16>>1]=g;J[a+18>>1]=g>>>16;J[a+20>>1]=d;J[a+22>>1]=d>>>16;d=M[b+12>>1]|M[b+14>>1]<<16;b=M[b+8>>1]|M[b+10>>1]<<16;J[a+8>>1]=b;J[a+10>>1]=b>>>16;J[a+12>>1]=d;J[a+14>>1]=d>>>16;I[v+177904|0]=0;J[a>>1]=M[a>>1]|32768;g=K[n+12>>2]}K[t+4>>2]=a;J[a+8>>1]=(Q(s,J[a+8>>1])|0)/256;J[a+6>>1]=(Q(q,J[a+6>>1])|0)/256;J[a+4>>1]=(Q(p,J[a+4>>1])|0)/256;J[a+12>>1]=(Q(y,J[a+12>>1])|0)/256;J[a+10>>1]=(Q(x,J[a+10>>1])|0)/256;f=f+1|0;if((g|0)>(f|0)){continue}break}}K[44469]=m}if(!a){break e}}if(h&4){J[a>>1]=M[a>>1]|32}if(!(h&2)){break e}J[a>>1]=M[a>>1]|16}if(h&64){tb(20,0)}a=i&h<<27>>31}else{a=0}g=a+K[36422]|0;K[36422]=g;b=K[n+12>>2]}d=b-1|0;p:{if((d|0)<=0){f=0;break p}a=0;i=0;f=0;if(b-2>>>0>=3){s=d&-4;m=0;while(1){h=i<<3;f=(((J[h+k>>1]+f|0)+J[k+(h|8)>>1]|0)+J[k+(h|16)>>1]|0)+J[k+(h|24)>>1]|0;i=i+4|0;m=m+4|0;if((s|0)!=(m|0)){continue}break}}h=d&3;if(!h){break p}while(1){f=J[k+(i<<3)>>1]+f|0;i=i+1|0;a=a+1|0;if((h|0)!=(a|0)){continue}break}}a=b;h=K[c+20>>2];q:{if(!h){break q}a=d;i=h+K[34460]|0;m=L[i+2|0];if(!m){break q}q=M[i+4>>1];J[k+(d<<3)>>1]=L[i+20|0];h=1;a=b;if((m|0)==1){break q}s=i+4|0;q=q&1;i=m-1|0;x=i&1;if((m|0)!=2){y=i&-2;m=0;while(1){t=s+(h<<6)|0;v=s+Q(h,44)|0;p=q?t:v;w=L[p+16|0];i=k+(a<<3)|0;K[i+4>>2]=p;J[i>>1]=w;J[i+2>>1]=M[p>>1];p=q?t- -64|0:v+44|0;t=L[p+16|0];K[i+12>>2]=p;J[i+8>>1]=t;J[i+10>>1]=M[p>>1];h=h+2|0;a=a+2|0;m=m+2|0;if((y|0)!=(m|0)){continue}break}}if(!x){break q}h=s+(q?h<<6:Q(h,44))|0;m=L[h+16|0];i=k+(a<<3)|0;K[i+4>>2]=h;J[i>>1]=m;J[i+2>>1]=M[h>>1];a=a+1|0}r:{if((f|0)<=0){break r}s:{t:{switch(A-1|0){case 1:h=(K[c+44>>2]+g|0)-45|0;h=(h|0)<=10?10:h;if(L[j|0]&8){h=h+(L[K[36128]+14|0]<<1)|0}if((d|0)<=0){break r}j=(h<<8)/(f|0)|0;i=0;if((b|0)!=2){b=d&-2;h=0;while(1){g=i<<3;f=g+k|0;J[f>>1]=(Q(j,J[f>>1])|0)/256;g=k+(g|8)|0;J[g>>1]=(Q(j,J[g>>1])|0)/256;i=i+2|0;h=h+2|0;if((b|0)!=(h|0)){continue}break}}if(!(d&1)){break r}b=k+(i<<3)|0;J[b>>1]=(Q(j,J[b>>1])|0)/256;break r;case 0:if(K[c>>2]!=1){break s}h=K[c+44>>2];if((h|0)>129){break s}J[k>>1]=(Q(h,J[k>>1])|0)/130;break s;default:break t}}h=K[c+44>>2];if((h|0)<=0){break s}g=(h-f|0)+g|0;K[36422]=g}if(!g|(d|0)<=0){break r}j=(f+g<<8)/(f|0)|0;i=0;if((b|0)!=2){b=d&-2;h=0;while(1){g=i<<3;f=g+k|0;J[f>>1]=(Q(j,J[f>>1])|0)/256;g=k+(g|8)|0;J[g>>1]=(Q(j,J[g>>1])|0)/256;i=i+2|0;h=h+2|0;if((b|0)!=(h|0)){continue}break}}if(!(d&1)){break r}b=k+(i<<3)|0;J[b>>1]=(Q(j,J[b>>1])|0)/256}K[u+108>>2]=a;sa=n+16|0;if(!k){break a}a=K[c+16>>2];if((a|0)!=K[36438]){K[36438]=a;b=(K[50758]<<4)+216192|0;K[b>>2]=14;K[b+4>>2]=a;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0}a=K[K[32972]+132>>2];i=a?1:3;b=K[k+4>>2];if(!(K[c+28>>2]|!L[145748])){I[145748]=0;i=a?2:4}d=K[36426];u:{if(!d){break u}a=M[d>>1];if(!((a&2)>>>1|L[d+16|0]<2)|a&16){break u}g=(K[36439]<<4)+216192|0;K[g+12>>2]=b;if(!(a&8)){break u}a=K[44469]+1|0;a=(a|0)<=169?a:0;K[44469]=a;h=a<<6;a=h+177888|0;if(a){j=M[b+4>>1]|M[b+6>>1]<<16;f=M[b>>1]|M[b+2>>1]<<16;J[a>>1]=f;J[a+2>>1]=f>>>16;J[a+4>>1]=j;J[a+6>>1]=j>>>16;j=M[b+60>>1]|M[b+62>>1]<<16;f=M[b+56>>1]|M[b+58>>1]<<16;J[a+56>>1]=f;J[a+58>>1]=f>>>16;J[a+60>>1]=j;J[a+62>>1]=j>>>16;j=M[b+52>>1]|M[b+54>>1]<<16;f=M[b+48>>1]|M[b+50>>1]<<16;J[a+48>>1]=f;J[a+50>>1]=f>>>16;J[a+52>>1]=j;J[a+54>>1]=j>>>16;j=M[b+44>>1]|M[b+46>>1]<<16;f=M[b+40>>1]|M[b+42>>1]<<16;J[a+40>>1]=f;J[a+42>>1]=f>>>16;J[a+44>>1]=j;J[a+46>>1]=j>>>16;j=M[b+36>>1]|M[b+38>>1]<<16;f=M[b+32>>1]|M[b+34>>1]<<16;J[a+32>>1]=f;J[a+34>>1]=f>>>16;J[a+36>>1]=j;J[a+38>>1]=j>>>16;j=M[b+28>>1]|M[b+30>>1]<<16;f=M[b+24>>1]|M[b+26>>1]<<16;J[a+24>>1]=f;J[a+26>>1]=f>>>16;J[a+28>>1]=j;J[a+30>>1]=j>>>16;j=M[b+20>>1]|M[b+22>>1]<<16;f=M[b+16>>1]|M[b+18>>1]<<16;J[a+16>>1]=f;J[a+18>>1]=f>>>16;J[a+20>>1]=j;J[a+22>>1]=j>>>16;j=M[b+12>>1]|M[b+14>>1]<<16;f=M[b+8>>1]|M[b+10>>1]<<16;J[a+8>>1]=f;J[a+10>>1]=f>>>16;J[a+12>>1]=j;J[a+14>>1]=j>>>16;I[h+177904|0]=0;J[a>>1]=M[a>>1]|32768}h=h+177888|0;J[h+8>>1]=M[d+8>>1];I[h+21|0]=L[d+21|0];J[h+10>>1]=M[d+10>>1];I[h+22|0]=L[d+22|0];J[h+12>>1]=M[d+12>>1];I[h+23|0]=L[d+23|0];J[h+14>>1]=M[d+14>>1];I[h+24|0]=L[d+24|0];I[h+25|0]=L[d+25|0];K[g+12>>2]=a}if(!((A|0)!=2|L[r+11|0]!=2)){Nb();K[36427]=K[50758]}r=K[u+108>>2];v:{if((r|0)<2){break v}a=K[36433];j=(Q(256-a|0,o)+(a<<8)|0)/256|0;a=K[36432];g=(Q(256-a|0,o)+(a<<8)|0)/256|0;f=K[50754];a=0;d=1;while(1){n=(k+(d<<3)|0)-8|0;h=M[n+2>>1];h=(Q((Q(f,J[n>>1])|0)/1e3|0,h&4?g:h&16384?j:o)|0)/256|0;K[(d<<2)+u>>2]=h;a=a+h|0;d=d+1|0;if((r|0)!=(d|0)){continue}break}w:{if((a|0)<=0|(a|0)>=(z|0)|(r|0)<2){break w}d=1;h=r-1|0;j=h&1;if((r|0)!=2){g=h&-2;o=0;while(1){h=(d<<2)+u|0;K[h>>2]=(Q(K[h>>2],z)|0)/(a|0);K[h+4>>2]=(Q(K[h+4>>2],z)|0)/(a|0);d=d+2|0;o=o+2|0;if((g|0)!=(o|0)){continue}break}}if(!j){break w}d=(d<<2)+u|0;K[d>>2]=(Q(K[d>>2],z)|0)/(a|0)}o=0;if((r|0)<2){break v}r=A+256|0;d=1;while(1){a=K[(k+(d<<3)|0)+4>>2];h=K[c+28>>2];if(!(!h|L[b|0]&128)){K[36422]=0;f=K[c>>2];j=K[c+32>>2];if(j){j=(j<<5)/100|0}else{j=32}Fc(h,r,0,f,0,j);I[145748]=1;K[c+28>>2]=0}x:{if((e|0)<0){break x}e=L[b|0]&64?6:e;if((K[u+108>>2]-1|0)!=(d|0)){break x}h=e;e=K[36436];e=h|(e&3840?e:0)}h=K[(d<<2)+u>>2];K[36440]=h+K[36440];K[36441]=h+K[36441];y:{if(!h){K[36426]=0;break y}j=K[50758];K[36439]=j;if((e|0)>=0){j=(j<<4)+216192|0;K[j>>2]=i;K[j+12>>2]=a;K[j+8>>2]=b;K[j+4>>2]=h+(e<<16);b=K[50758]+1|0;K[50758]=(b|0)<=169?b:0}K[36426]=a;o=h+o|0}b=a;d=d+1|0;if((d|0)<K[u+108>>2]){continue}break}}if(!K[36438]|(A|0)==1){break a}K[36438]=0;a=(K[50758]<<4)+216192|0;K[a>>2]=14;K[a+4>>2]=0;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0}sa=u+112|0}function Mb(a,b,c,d){var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0;e=sa-1856|0;sa=e;K[e+164>>2]=0;a:{if(c){m=K[c>>2];break a}c=e- -64|0;Ea(c,0,96)}K[33264]=0;K[e+1824>>2]=0;K[e+1828>>2]=0;K[e+1832>>2]=0;K[e+1836>>2]=0;I[e+1616|0]=0;I[e+992|0]=0;I[e+1200|0]=0;I[e+784|0]=0;b:{if(!K[a+688>>2]){I[189088]=0;break b}K[e+1840>>2]=b;f=b;if(L[f|0]==32){f=b+1|0;K[e+1840>>2]=f}n=e+416|1;w=e+1844|1;y=e+1848|1;z=e+1852|1;K[e+1820>>2]=f;Ga(e+168|0,f);f=K[e+1820>>2];while(1){if((L[f|0]|32)!=32){f=Ga(e+164|0,f)+K[e+1820>>2]|0;K[e+1820>>2]=f;q=q+1|0;continue}break}h=f-b|0;x=(h|0)>=159?159:h;Fa(e+256|0,b,x);u=m&4194304;c:{if(!(!u|(q|0)!=1)){g=1;Ga(e+172|0,f+1|0);d:{if(!Ma(K[e+172>>2])){break d}if((hc(K[e+164>>2])|0)!=(hc(K[e+172>>2])|0)){break d}g=0}f=K[47202];s=(f|0)==36?4:g;g=0;break c}f=K[47202];s=((f|0)==36)<<2;if((q|0)==1|(f|0)!=36){break c}f=K[e+1840>>2]-1|0;K[e+1840>>2]=f;I[f|0]=95;s=0;g=(Wa(a,e+1840|0,e+1616|0,e+1832|0,0,c)|0)!=0;f=K[47202]}e:{f:{g:{h:{i:{if(f&16){o=f&15;s=0;break i}r=1;if(!g){r=(Wa(a,e+1840|0,e+1616|0,e+1832|0,2,c)|0)!=0}f=K[e+1832>>2];j:{if(!(f&50331648)){break j}h=K[e+1820>>2];if(L[h+1|0]!=46){break j}I[h+1|0]=32;f=K[e+1832>>2]}if(f&536870912){if(!d){break b}Ca(d,K[e+1840>>2]);break b}k:{if(f&8192|(!(f&128)|r)){d=K[33264];break k}f=K[e+1840>>2];K[e+1820>>2]=f;d=K[33264];if((d|0)<=0){break k}g=0;while(1){if(L[f|0]==32){I[f|0]=45;g=g+1|0;f=K[e+1820>>2];d=K[33264]}f=f+1|0;K[e+1820>>2]=f;if((d|0)>(g|0)){continue}break}}l:{if(d|(q|0)!=1){break l}l=K[e+1840>>2];h=Ga(e+576|0,l);if(L[h+l|0]!=32){break l}g=e+1408|0;d=l;m:{n:{o:{while(1){p:{if(!Ma(K[e+576>>2])){break p}i=d+h|0;q:{if(L[i+1|0]==46){o=0;r:{f=h+2|0;switch(L[f+d|0]-32|0){case 0:break q;case 7:break r;default:break p}}o=1;h=f;if(L[i+3|0]==115){break q}break p}o=1;if((k|0)<=0){break o}}s:{if((h|0)<=0){break s}p=h&3;j=0;t:{if(h>>>0<4){f=0;break t}t=h&-4;f=0;i=0;while(1){I[g|0]=L[d+f|0];I[g+1|0]=L[(f|1)+d|0];I[g+2|0]=L[(f|2)+d|0];I[g+3|0]=L[(f|3)+d|0];f=f+4|0;g=g+4|0;i=i+4|0;if((t|0)!=(i|0)){continue}break}}if(!p){break s}while(1){I[g|0]=L[d+f|0];f=f+1|0;g=g+1|0;j=j+1|0;if((p|0)!=(j|0)){continue}break}}k=k+1|0;if(o){d=d+h|0;break p}d=(d+h|0)+3|0;h=Ga(e+576|0,d);if(L[d+h|0]==32){continue}}break}if((k|0)<2){break o}f=e+1408|0;h=g-f|0;f=Fa(l,f,h);h=h+f|0;if(h>>>0<d>>>0){Ea(h,32,(e+1408|0)+d-(f+g)|0)}K[33264]=(k<<1)-2;K[e+1836>>2]=0;break n}if(!k){break l}K[e+1832>>2]=0;K[e+1836>>2]=0;if(!K[33264]){break m}}K[e+1832>>2]=128}s=1}if(L[e+1616|0]==21){Ca(189088,e+1616|0);f=0;break b}A=L[e+1833|0];g=1;u:{if(r){break u}if(K[e+168>>2]-48>>>0<10){Da(a,84174,189088);f=0;if(L[189088]==21){break b}if(!(!(L[a+109|0]&128)|L[c+2|0]&32)){I[189088]=21;I[189089]=0;break b}g=(Dd(a,K[e+1840>>2],e+1616|0,e+1832|0,c,0)|0)!=0}else{g=0}if(g|(m&3)==2){break u}d=K[a+104>>2];if(!(d&16777216)){g=0;if(!(d&33554432)|!(m&1)){break u}}if(!(m&16)){g=0;if(I[c+13|0]&1){break u}}t=K[e+1840>>2];f=0;k=0;i=0;p=sa-224|0;sa=p;j=e+1616|0;I[j|0]=0;K[p+216>>2]=0;K[p+220>>2]=0;v:{if(I[t-2|0]-48>>>0<10|(I[c|0]&1?0:L[a+107|0]&2)){break v}h=t+1|0;d=L[h|0];if((!(M[a+106>>1]&2561)|!(I[c+2|0]&1))&(d|0)==32){break v}k=L[t|0];w:{if((k|0)==32){g=h;break w}o=32767;d=0;while(1){f=Wb(101868,k<<24>>24,8);if(!f){k=0;break v}l=0;x:{f=K[(f<<2)-305584>>2];if((f|0)!=(d|0)){break x}l=i+1|0;if((l|0)<=2){break x}k=0;break v}y:{z:{A:{B:{C:{if((d|0)<2){break C}if((d|0)==10|(d|0)==100){break B}if((d|0)>(f|0)){break C}k=0;break v}if(!d){break z}if((d|0)<(f|0)){break A}break z}if((d|0)>=(f|0)){break z}}k=0;if((v|0)%10|(Q(d,10)|0)<(f|0)){break v}f=f-d|0;o=d;break y}if((f|0)>=(o|0)){k=0;break v}v=d+v|0}k=L[h|0];g=h+1|0;h=g;d=f;i=l;if((k|0)!=32){continue}break}d=L[g|0]}if((d<<24>>24)-48>>>0<10){k=0;break v}d=f+v|0;if((d|0)<K[a+120>>2]){k=0;break v}if((d|0)>K[a+116>>2]){k=0;break v}Da(a,85600,p+176|0);f=j;if(!(L[a+107|0]&4)){f=p+176|0;f=Ca(j,f)+Ba(f)|0}K[p+4>>2]=K[a+140>>2];K[p>>2]=d;Aa(p+16|0,85839,p);k=0;if(L[g|0]==46){break v}if(Ed(a,t,g,c,1)){K[c>>2]=K[c>>2]|32768}h=0;D:{if(!(L[a+107|0]&8)){break D}i=K[c>>2];if(K[a+212>>2]==26741){if(i&32768){break D}if(!(i&16384)){break v}h=1;i=0;E:{F:{switch(L[g|0]-97|0){case 0:case 4:break F;default:break E}}G:{H:{I:{J:{o=L[g+1|0];switch(o-116|0){case 6:break E;case 1:case 2:case 3:case 4:case 5:break H;case 0:break J;default:break I}}if(L[g+2|0]!=116){break G}break E}if((o|0)==32){break E}}if((d|0)%1e3|0){break G}if((o|0)==108){break E}}i=1}if(i){break D}break v}K[c>>2]=i|32768}d=a+8232|0;K[d>>2]=0;K[d+4>>2]=0;Dd(a,p+16|2,f,p+216|0,c,h);k=1;if(!(L[a+107|0]&4)){break v}Za(j,p+176|0)}sa=p+224|0;if(!k){g=0;break u}K[e+1832>>2]=K[e+1832>>2]|8192;g=1}o=r?s:A&32?1:s;s=0;if(!(m&1)|(q|0)<2){break i}if(!pb(K[e+168>>2])){break i}K:{if(I[188785]&1){f=K[e+1832>>2];d=f&8192;if(!(!d|g)){break K}s=d>>>2^2048;break i}if(g){break h}f=K[e+1832>>2]}if(f&128|q>>>0>3){break i}f=K[a+8220>>2];if((f|0)<4){break i}d=1;if((f|0)>=K[a+8216>>2]){break e}}j=0;if((o|0)<=0){break g}d=o;break e}d=o;if((d|0)>0){break e}j=0;l=0;i=0;k=0;break f}if(g){l=0;i=0;k=0;break f}d=K[e+1840>>2];K[e+1820>>2]=d;f=999;k=0;l=0;n=0;L:{M:{N:{while(1){O:{P:{Q:{if(f-1>>>0>=2){if((q|0)<2){break Q}Ga(e+1408|0,d);f=K[e+1408>>2];if((f|0)<577&K[a+600>>2]>0){break Q}f=hc(f);if((K[f+4>>2]!=K[a+600>>2]?f:0)|K[a+40>>2]==1){break Q}f=L[d|0];K[e+1408>>2]=f<<24>>24;R:{switch(f-32|0){default:if(!f){break Q}break;case 0:case 7:break Q;case 1:case 2:case 3:case 4:case 5:case 6:break R}}j=Ga(e+1408|0,d);r=9;S:{T:{U:{f=K[e+1408>>2];V:{if(!(f&-33)){i=0;break V}g=0;i=0;while(1){W:{X:{if((f|0)==39){if((l|0)>0|(g|0)>1){break V}i=g?i:39;if(K[a+40>>2]!=3){break X}break W}i=g?i:f}g=g+1|0}if(!Nd(a,f)){f=K[e+1408>>2];if((f|0)!=39){if(!pb(f)){break Q}}j=Ga(e+1408|0,d+j|0)+j|0;f=K[e+1408>>2];if(f&-33){continue}break V}break}if((g|0)<=2){break U}r=g}f=K[a+40>>2];if((f|0)!=2){break T}f=sa-208|0;sa=f;I[f|0]=0;h=d-1|0;g=L[h|0];I[h|0]=32;d=jb(a,d,f,200,0,-2147483648,0);I[h|0]=g;sa=f+208|0;d=!d|(d&32768)>>>15;break S}f=K[a+40>>2];r=g}d=(I[a+168|0]+1|0)<(r-((f|0)==(i|0))|0)}if(!d){break Q}d=K[e+1820>>2]}if(L[d|0]!=39){break P}k=67108864;s=0}j=0;Fd(a,e+992|0,0,l);d=K[e+1820>>2];f=L[d|0];if((f|0)!=32){break O}l=0;i=0;break f}s=0;n=(l|0)>0|n;d=pd(a,d,e+992|0,n&1)+K[e+1820>>2]|0;K[e+1820>>2]=d;if(L[e+992|0]==21){break N}l=l+1|0;g=0;while(1){f=g;g=f+1|0;if(L[d+f|0]!=32){continue}break}k=67108864;continue}break}if(!(!L[e+992|0]|(f|0)==39)){I[d-1|0]=32;d=K[e+1820>>2]}h=jb(a,d,e+1616|0,200,e+784|0,m,e+1832|0);d=L[e+1616|0];if((d|0)==21){Ca(189088,e+1616|0);f=0;break b}Y:{if(d|L[e+784|0]){break Y}Ga(e+1408|0,K[e+1820>>2]);if((q|0)!=1){break Y}if(!Ma(K[e+1408>>2])){if(!Gd(K[e+1408>>2])){break Y}}if(od(a,K[e+1820>>2],e+1616|0,o)){Ca(189088,e+1616|0)}f=0;break b}K[e+172>>2]=I[K[e+1820>>2]-1|0];Z:{if(!(h&1024)){j=h;l=0;n=0;d=0;break Z}t=e+176|1;o=0;f=1;n=0;l=0;while(1){_:{$:{r=h&131072;if(r|!(f&1)){break $}I[e+1408|0]=0;d=jb(a,K[e+1820>>2],e+1408|0,200,e+576|0,m|805306368,e+1832|0);if(!d){break $}f=e+416|0;Oc(a,K[e+1820>>2],d,f);j=jb(a,K[e+1820>>2],e+1616|0,200,e+784|0,m|268435456,e+1832|0);Fa(K[e+1820>>2],f,Ba(f));if(!(j&1024)){Ca(e+1616|0,e+1408|0);f=Ca(e+784|0,e+576|0);if(L[188788]&8){i=f;f=e+576|0;Ab(i,f);h=K[47195];K[e+48>>2]=f;Na(h,85205,e+48|0)}j=d}f=0;break _}if(h&2048){K[a+8184>>2]=1}I[K[e+1820>>2]-1|0]=K[e+172>>2];aa:{ba:{ca:{da:{if(!r){f=K[e+1820>>2];i=h&15;if(!i){break ca}d=0;g=i;j=h&3;if(j){while(1){f=f+1|0;K[e+1820>>2]=f;if((L[f|0]&192)==128){continue}g=g-1|0;d=d+1|0;if((j|0)!=(d|0)){continue}break}}if(i>>>0<4){break da}while(1){f=f+1|0;K[e+1820>>2]=f;if((L[f|0]&192)==128){continue}while(1){f=f+1|0;K[e+1820>>2]=f;if((L[f|0]&192)==128){continue}break}while(1){f=f+1|0;K[e+1820>>2]=f;if((L[f|0]&192)==128){continue}break}while(1){f=f+1|0;K[e+1820>>2]=f;if((L[f|0]&192)==128){continue}break}d=(g|0)>4;g=g-4|0;if(d){continue}break}break da}I[e+176|0]=0;f=K[e+1820>>2];d=1;i=h&63;ea:{if(!i){break ea}p=h&1;l=i-1|0;g=0;if((i|0)!=1){v=i-p|0;i=0;while(1){j=f;K[e+1820>>2]=f+1;u=(e+176|0)+d|0;I[u|0]=(g|0)!=(l|0)?L[f|0]:0;f=f+2|0;K[e+1820>>2]=f;I[u+1|0]=(l|0)!=(g|1)?L[j+1|0]:0;g=g+2|0;d=d+2|0;i=i+2|0;if((v|0)!=(i|0)){continue}break}}if(!p){break ea}i=f+1|0;K[e+1820>>2]=i;I[(e+176|0)+d|0]=(g|0)!=(l|0)?L[f|0]:0;d=d+1|0;f=i}I[(e+176|0)+d|0]=0}d=f-1|0;K[e+172>>2]=I[d|0];I[d|0]=32;m=m|8388608;d=m;if(!r){break ba}La(e+576|0,e+784|0,12);K[e+1852>>2]=t;f=e+1616|0;d=Ca(e+1200|0,f);if(Wa(a,e+1852|0,f,e+1832|0,0,c)){Ca(d,e+1616|0)}if(!(L[e+1833|0]&32)){break aa}I[d|0]=0;od(a,K[e+1852>>2],d,1);break aa}d=f-1|0;K[e+172>>2]=I[d|0];I[d|0]=32;d=m|8388608}m=d;Za(e+1200|0,e+784|0)}I[e+784|0]=0;i=1;d=Wa(a,e+1820|0,e+1616|0,e+1824|0,1024,c);if(!K[e+1832>>2]){f=K[e+1828>>2];K[e+1832>>2]=K[e+1824>>2];K[e+1836>>2]=f;i=n}if(d){j=0;l=h;break L}j=jb(a,K[e+1820>>2],e+1616|0,200,e+784|0,m&8404992,e+1832|0);f=1;l=h;n=i;if(L[e+1616|0]!=21){break _}I[K[e+1820>>2]-1|0]=K[e+172>>2];Ca(189088,e+1616|0);f=0;break b}g=j&1024;d=g>>>10|0;if(o>>>0>48){break Z}o=o+1|0;h=j;if(g){continue}break}}if(d|!j){break M}h=Ca(e+1408|0,e+1616|0);g=Oc(a,K[e+1820>>2],j,e+416|0);i=n;f=j;while(1){fa:{I[e+1616|0]=0;if(L[e+1200|0]){I[K[e+1820>>2]-1|0]=K[e+172>>2];d=Wa(a,e+1840|0,e+1616|0,e+1824|0,g,c);I[K[e+1820>>2]-1|0]=32;if(L[e+1616|0]==21){a=e+416|0;Fa(K[e+1820>>2],a,Ba(a));Ca(189088,e+1616|0);f=0;break b}if(!K[e+1832>>2]){n=K[e+1828>>2];K[e+1832>>2]=K[e+1824>>2];K[e+1836>>2]=n}if(d){I[e+1200|0]=0;break fa}i=K[e+1824>>2]?1:i}d=Wa(a,e+1820|0,e+1616|0,e+1824|0,g,c);if(L[e+1616|0]==21){a=e+416|0;Fa(K[e+1820>>2],a,Ba(a));Ca(189088,e+1616|0);f=0;break b}if(!K[e+1832>>2]){n=K[e+1828>>2];K[e+1832>>2]=K[e+1824>>2];K[e+1836>>2]=n}if(d){break fa}if(f&16384){Ca(e+1616|0,h);break fa}m=g<<11&8192|f<<9&134217728|m;ga:{if(f&524288){d=e+784|0;n=Ca(e+576|0,d);f=jb(a,K[e+1820>>2],e+1616|0,200,d,m,e+1832|0);Za(d,n);d=0;if(!f){f=0;break ga}if(f&1024){break ga}d=1;g=Oc(a,K[e+1820>>2],f,0);break ga}f=0;jb(a,K[e+1820>>2],e+1616|0,200,0,m,e+1832|0);d=0}if(L[e+1616|0]==21){Ca(189088,e+1616|0);a=e+416|0;Fa(K[e+1820>>2],a,Ba(a));I[K[e+1820>>2]-1|0]=K[e+172>>2];f=0;break b}if(d){continue}}break}if(!(j&65536)){Qc(a,e+1616|0,200,e+784|0);I[e+784|0]=0}d=e+416|0;Fa(K[e+1820>>2],d,Ba(d));break L}a=e+992|0;Ca(189088,a);f=!$a(a|1,84744,3)<<12;break b}j=0;i=n}I[K[e+1820>>2]-1|0]=K[e+172>>2]}d=K[e+164>>2];K[e+1852>>2]=8026656;K[e+1848>>2]=8022304;K[e+1844>>2]=7566112;if(m&4){f=d&255;ha:{if(f){if((f|0)==102){break ha}w=y;if(Re(d<<24>>24)){break ha}}w=z}jb(a,w,189088,200,0,0,0)}d=0;f=e+1200|0;n=L[e+784|0];while(1){ia:{ja:{ka:{h=L[f|0];switch(h|0){case 0:break ia;case 6:case 7:break ka;default:break ja}}d=h}f=f+1|0;continue}break}la:{if(d|i){if(K[a+32>>2]|l&65536){g=0;kb(a,e+1616|0,e+1832|0,3,0);f=e+1200|0;while(1){ma:{switch(L[f|0]){case 6:if(g){I[f|0]=5}g=1;default:f=f+1|0;continue;case 0:break ma}}break}K[e+24>>2]=e+1616;K[e+20>>2]=e+1200;K[e+16>>2]=e+992;sb(189088,200,85233,e+16|0);I[189287]=0;kb(a,189088,e+1832|0,-1,0);break la}K[e+8>>2]=e+1616;K[e+4>>2]=e+1200;K[e>>2]=e+992;sb(189088,200,85233,e);I[189287]=0;kb(a,189088,e+1832|0,-1,0);break la}d=e+1616|0;kb(a,d,e+1832|0,-1,((n|0)!=0)<<1);K[e+40>>2]=d;K[e+36>>2]=e+1200;K[e+32>>2]=e+992;sb(189088,200,85233,e+32|0);I[189287]=0}if(L[e+784|0]){d=Ba(189088);I[(e-d|0)+983|0]=0;Ca(d+189088|0,e+784|0)}d=m|s;if(d&16){K[e+1832>>2]=K[e+1832>>2]&-268435457}na:{if(!(!(d&128)|!(L[a+14|0]&16))){Dc(a,3);break na}if(d&3072){Dc(a,6);if(!(d&2048)){break na}K[e+1832>>2]=K[e+1832>>2]|268435456;break na}if(!(L[Q(K[33264],12)+c|0]&16)){break na}c=K[e+1832>>2];if(c&1536){Dc(a,4);break na}if(!(c&2048)){break na}Dc(a,3)}if(j&8192){K[a+8192>>2]=2;K[a+8184>>2]=2}c=K[e+1836>>2];oa:{pa:{if(c&8){K[a+8184>>2]=0;K[a+8188>>2]=3;d=a+8196|0;break pa}if(c&1){K[a+8192>>2]=0;K[a+8184>>2]=2;d=a+8196|0;break pa}if(c&2){K[a+8192>>2]=2;K[a+8184>>2]=0;K[a+8188>>2]=0;d=a+8196|0;break pa}if(!(c&4)){break oa}K[a+8184>>2]=0;K[a+8192>>2]=0;K[a+8196>>2]=2;d=a+8188|0}K[d>>2]=0}qa:{if(!L[K[e+1820>>2]]|c&256){break qa}c=K[a+8184>>2];if((c|0)>0){K[a+8184>>2]=c-1}c=K[a+8192>>2];if((c|0)>0){K[a+8192>>2]=c-1}c=K[a+8196>>2];if((c|0)>0){K[a+8196>>2]=c-1}c=K[a+8188>>2];if((c|0)<=0){break qa}K[a+8188>>2]=c-1}ra:{if((q|0)!=1|K[a+212>>2]!=25966){break ra}if(!pb(K[e+168>>2])|K[e+168>>2]==105){break ra}K[e+1832>>2]=K[e+1832>>2]|16777216}sa:{if(!(L[a+68|0]&2)){break sa}d=K[e+1832>>2];if(!(d&98304)){break sa}c=Ba(189088)-1|0;if((c|0)<=0){break sa}f=0;while(1){a=f+1|0;if(L[f+189088|0]==6){a=a+189088|0;c=I[a|0];ta:{if(d&65536){ua:{if((eb(69)|0)!=(c|0)){q=L[a|0];break ua}q=eb(101);I[a|0]=q}g=111;if((eb(79)|0)==q<<24>>24){break ta}break sa}va:{if((eb(101)|0)!=(c|0)){q=L[a|0];break va}q=eb(69);I[a|0]=q}g=79;if((eb(111)|0)!=q<<24>>24){break sa}}I[a|0]=eb(g);break sa}f=a;if((c|0)!=(f|0)){continue}break}}a=K[e+1832>>2];Fa(b,e+256|0,x);f=a|k;break b}f=0;I[e+1616|0]=0;if(!od(a,K[e+1840>>2],e+1616|0,d)){f=((q|0)>1)<<12;break b}h=Ca(189088,e+1616|0);if(u){break b}d=K[e+164>>2];K[e+1408>>2]=8026656;K[e+576>>2]=8022304;K[e+416>>2]=7566112;if(m&4){b=e+576|1;c=e+1408|1;f=d&255;wa:{if(f){if((f|0)==102){break wa}n=b;if(Re(d<<24>>24)){break wa}}n=c}jb(a,n,h,200,0,0,0)}f=K[e+1832>>2]&128}sa=e+1856|0;return f}function cc(a,b,c,d,e,f,g,h){var i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,J=0,M=0,N=0,O=0,P=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0;p=sa-384|0;sa=p;D=K[b>>2];a:{b:{c:{d:{if(e){if(L[e|0]!=7){break d}K[b>>2]=(d?d:1)+D;break c}K[f>>2]=0;K[b>>2]=D+1;break a}E=86135;P=g&268435456;R=g&134217728;S=g&8388608;T=g&16384;U=g&8192;H=c-1|0;J=d-c|0;V=g&2;W=g&128;X=g>>>31|0;Y=g&-2147483648;M=p+96|1;e:while(1){K[p+268>>2]=0;k=K[b>>2];o=k+d|0;x=-2;v=-6;c=e;y=Y;A=0;F=0;w=1;i=0;z=0;C=0;while(1){l=k;q=i;f:{g:{h:{i:{j:{k:{l:{m:{n:{o:{p:{q:{r:{s:{t:{u:{while(1){v:{s=c;c=c+1|0;j=L[s|0];if(j>>>0>9){break v}m=c;w:{switch(j|0){case 0:c=N;if(!c){N=0;c=86135;break t}while(1){j=1;x:{y:{i=L[c|0];switch(i|0){case 0:case 3:break u;case 5:break y;default:break x}}j=2}c=(c+j|0)+(((i|0)==9)<<1)|0;continue};case 1:C=1;if(!X){continue}break j;case 2:C=2;continue;case 4:N=c;continue;case 5:c=s+2|0;i=K[a+320>>2];k=L[s+1|0];z:{if(k>>>0>=32){if(!(i>>>k-32&1)){break z}break j}if(!(i>>>k&1)){break j}}w=w+1|0;continue;case 9:c=s+3|0;continue;case 8:C=1;F=1;y=0;break;case 3:break s;default:break w}}continue}break}m=0;i=q;k=l;A:{switch(C|0){case 0:i=L[o|0];B:{C:{if((i|0)!=(j|0)){if((i|0)!=69){break j}if((j|0)==101){break C}break j}m=0;if((j&192)==128){break B}}m=21}o=o+1|0;A=A+1|0;break f;case 1:break r;case 2:break A;default:break o}}K[p+264>>2]=K[p+268>>2];if(!L[o-1|0]){break j}i=v+6|0;v=(i|0)>=19?19:i;u=o+1|0;t=Ga(p+268|0,o);r=L[o|0];m=20;i=q;D:{E:{switch(j-11|0){case 6:c=s+2|0;i=K[p+268>>2];k=I[s+1|0];k=((k|0)<65?191:-65)+k|0;j=K[((k<<2)+a|0)+604>>2];F:{if(j){i=(Ta(j,i)|0)!=0;break F}if((k|0)>7){break j}j=K[a+600>>2];G:{if((j|0)>0){i=i-j|0;if(i-1>>>0<255){break G}break j}j=i-192|0;if(j>>>0<=413){i=L[(L[j+94240|0]+a|0)+344|0]&1<<k;break F}if(i>>>0>255){break j}}i=L[(a+i|0)+344|0]&1<<k}if(!i){break j}o=o+t|0;m=((k|0)==2?19:20)-v|0;break f;case 7:c=s+2|0;i=I[s+1|0];i=K[((((i|0)<65?191:-65)+i<<2)+a|0)+4788>>2];if(!i){break j}H:while(1){m=L[i|0];if((m|0)==7){break j}if((m|0)==126){m=20-v|0;break f}I:{if(!r){j=i;n=o;break I}n=o;j=i;if((m|0)!=(r|0)){break I}while(1){j=j+1|0;m=L[j|0];n=n+1|0;i=L[n|0];if((m|0)!=(i|0)){break I}if(i){continue}break}}if(m){while(1){k=L[j|0];i=j+1|0;j=i;if(k){continue}continue H}}break};i=n-o|0;if((i|0)<0){break j}o=i+o|0;m=20-v|0;break f;case 14:j=K[p+268>>2];i=K[a+604>>2];J:{K:{if(i){i=(Ta(i,j)|0)!=0;break K}i=K[a+600>>2];L:{if((i|0)>0){n=j-i|0;if(n-1>>>0<255){break L}break J}i=j-192|0;if(i>>>0<=413){i=I[(L[i+94240|0]+a|0)+344|0]&1;break K}n=j;if(j>>>0>255){break g}}i=I[(a+n|0)+344|0]&1}if(i){break j}j=K[p+268>>2]}if(!R){break g}if((j|0)==32){break j}break g;case 4:i=K[p+268>>2];if(i-48>>>0<10|i-2406>>>0<10){break g}if(!L[a+170|0]){break j}m=20-v|0;break f;case 5:if(uc(K[p+268>>2])){break j}break h;case 0:if(K[p+268>>2]==K[p+264>>2]){break h}break j;case 17:c=s+2|0;i=32768;m=0;M:{N:{j=L[s+1|0];switch(j-1|0){case 0:break o;case 1:break N;default:break M}}m=1;i=q;if(!S){break o}break j}i=j&240;if((i|0)==16){m=23;i=q;if(h>>>(j&15)&16384){break o}break j}if((j|0)!=3&(i|0)!=32){break f}i=p+96|0;k=(K[b>>2]+(A+J|0)|0)+1|0;Fa(i,H,k);i=i+k|0;I[i|0]=32;I[i+1|0]=0;K[33265]=0;K[33266]=0;K[p+16>>2]=M;Wa(a,p+16|0,p+272|0,133060,0,0);m=23;n=K[33265];if(!((j|0)!=3|(n|0)>=0|K[33266]&16384)){break f}i=q;k=l;if(n>>>(j&15)&16384){break o}break j;case 34:i=r-32|0;O:{if(i){if((i|0)==13){break O}else{break j}}if(!T){break j}}n=22-v|0;break i;case 10:i=1;if(L[c|0]==21){break D}break k;case 18:n=K[p+268>>2];if((n|0)!=32){j=o+t|0;while(1){i=K[a+632>>2];P:{Q:{if(i){i=(Ta(i,n)|0)!=0;break Q}i=K[a+600>>2];R:{if((i|0)>0){n=n-i|0;if(n-1>>>0<255){break R}break P}i=n-192|0;if(i>>>0<=413){i=L[(L[i+94240|0]+a|0)+344|0]&128;break Q}if(n>>>0>255){break P}}i=L[(a+n|0)+344|0]&128}if(i){break j}}j=Ga(p+268|0,j)+j|0;n=K[p+268>>2];if((n|0)!=32){continue}break}}n=19-v|0;break i;case 49:break l;case 2:break m;case 3:break n;case 1:break o;case 13:break p;case 12:break E;default:break q}}Ga(p+272|0,c);t=-1;i=K[p+272>>2];j=K[p+268>>2];S:{if((i|0)==(j|0)){r=o;break S}if(!(j&-33)){r=o;break S}while(1){r=o;t=-1;T:{if((i|0)!=18){break T}i=I[s+2|0];m=K[((((i|0)<65?191:-65)+i<<2)+a|0)+4788>>2];if(!m){break T}while(1){k=L[m|0];if((k|0)==7){break T}if((k|0)==126){t=0;break T}o=L[r|0];U:{if((o|0)!=(k|0)){j=m;i=r;break U}i=r;j=m;if(!o){break U}while(1){j=j+1|0;k=L[j|0];i=i+1|0;m=L[i|0];if((k|0)!=(m|0)){break U}if(m){continue}break}}if(k){while(1){i=L[j|0];m=j+1|0;j=m;if(i){continue}break}continue}else{i=i-r|0}break}t=i}k=Ga(p+268|0,r);i=K[p+272>>2];j=K[p+268>>2];if((i|0)==(j|0)|!(j&-33)){break S}o=k+r|0;if((t|0)==-1){continue}break}}o=(i|0)==(j|0)?r:(t|0)>=0?r:u;m=0;break f}while(1){i=i+1|0;c=c+1|0;if(L[c|0]==21){continue}break}break k}c=c+1|0}m=s}V:{if(L[l-1|0]!=32&F|y){break V}j=F?w+4|0:w;if((j|0)>=(G|0)){Z=z;_=q;G=j;$=A;E=c}if(!(K[47197]&8)|P|(j|0)<=0){break V}s=p+272|0;Ab(c,s);u=K[47195];k=p+16|0;c=0;r=0;y=0;z=0;o=sa-496|0;sa=o;I[o+80|0]=0;if((d|0)>0){Fa(o+288|0,D,d);q=d}else{q=0}i=o+288|0;I[q+i|0]=0;l=Ba(i)+i|0;t=(g|0)<0;while(1){n=L[e|0];q=e;e=e+1|0;if(n>>>0>9){while(1){W:{X:{Y:{Z:{_:{$:{i=n&255;switch(i-14|0){case 4:break Y;case 3:break Z;case 0:break _;case 14:break $;default:break X}}q=q+2|0;n=32;e=L[e|0];if(!t&(e|0)==1){break W}I[l|0]=36;i=l+1|0;e=$b(128960,e);Ca(i,e);l=Ba(e)+i|0;break W}i=L[q+2|0];n=L[e|0];K[o+36>>2]=L[q+3|0]&127;K[o+32>>2]=i&4?80:83;Aa(o+48|0,85131,o+32|0);if(i&1){e=o+48|0;e=Ba(e)+e|0;I[e|0]=101;I[e+1|0]=0}e=i&127;if(e&2){i=o+48|0;i=Ba(i)+i|0;I[i|0]=105;I[i+1|0]=0}if(e&4){i=o+48|0;i=Ba(i)+i|0;I[i|0]=112;I[i+1|0]=0}if(e&8){i=o+48|0;i=Ba(i)+i|0;I[i|0]=118;I[i+1|0]=0}if(e&16){i=o+48|0;i=Ba(i)+i|0;I[i|0]=100;I[i+1|0]=0}if(e&32){i=o+48|0;i=Ba(i)+i|0;I[i|0]=102;I[i+1|0]=0}if(e>>>0>=64){e=o+48|0;e=Ba(e)+e|0;I[e|0]=113;I[e+1|0]=0}if(n&1){e=o+48|0;e=Ba(e)+e|0;I[e|0]=116;I[e+1|0]=0}q=q+4|0;e=o+48|0;l=Ca(l,e)+Ba(e)|0;n=32;break W}q=q+2|0;n=L[I[e|0]+93871|0];break W}e=I[e|0];I[l|0]=76;e=e+((e|0)<65?191:-65)|0;i=(e>>>0)/10|0;I[l+1|0]=i+48;n=e-Q(i,10)|48;if((z|0)==1){I[l|0]=n;n=76}q=q+2|0;l=l+2|0;break W}if(i>>>0<=31){n=L[i+93904|0]}else{n=(i|0)==32?95:n}q=e}I[l|0]=n;e=q+1|0;l=l+1|0;n=L[q|0];if(n>>>0>=10){continue}break}}i=1;aa:{switch(n|0){case 1:i=c;case 8:I[l|0]=0;l=o+80|0;c=i;z=1;continue;case 2:I[l|0]=0;i=o+288|0;q=Ba(i)+i|0;l=L[84899]|L[84900]<<8;I[q|0]=l;I[q+1|0]=l>>>8;z=2;I[q+2|0]=L[84901];l=Ba(i)+i|0;continue;case 5:r=I[e|0];e=q+2|0;continue;case 9:y=(L[e|0]+Q(L[q+2|0],255)|0)-256|0;e=q+3|0;continue;case 0:case 3:break aa;default:continue}}break}I[l|0]=0;l=k;if((y|0)>0){K[o+16>>2]=y;Aa(k,85581,o+16|0);l=k+7|0}if((r|0)>0){K[o>>2]=r;Aa(l,85694,o);l=Ba(l)+l|0}e=Ba(o+80|0);if(((e|0)>0|c)&1){if(c&1){I[l|0]=95;l=l+1|0}q=e-1|0;ba:{if((q|0)<0|l>>>0>=k>>>0){break ba}while(1){I[l|0]=L[(o+80|0)+q|0];l=l+1|0;if((q|0)<=0){break ba}q=q-1|0;if(l>>>0<k>>>0){continue}break}}I[l|0]=41;I[l+1|0]=32;l=l+2|0}I[l|0]=0;c=o+288|0;I[c+((k+3|0)-l|0)|0]=0;Za(l,c);c=Ba(k);if((c|0)<=7){Ea(c+k|0,32,8-c|0);c=8}I[c+k|0]=0;sa=o+496|0;K[p+4>>2]=k;K[p>>2]=(d|0)>1?j+35|0:j;K[p+8>>2]=s;Na(u,89088,p)}c=m;break j}if(!L[l|0]){break j}i=x+2|0;x=(i|0)>=19?19:i;Ga(p+264|0,l);k=l-1|0;i=mc(p+268|0,k);r=L[k|0];u=k;ca:{da:{ea:{fa:{ga:{ha:{switch(j-10|0){case 13:B=L[c|0];j=L[l|0];i=(B|0)==(j|0);t=-1;if((j|0)==32|(j|0)==(B|0)){break fa}if(j){break ga}break ea;case 7:c=s+2|0;m=K[p+268>>2];l=I[s+1|0];l=((l|0)<65?191:-65)+l|0;j=K[((l<<2)+a|0)+604>>2];ia:{if(j){j=(Ta(j,m)|0)!=0;break ia}if((l|0)>7){break j}j=K[a+600>>2];ja:{if((j|0)>0){m=m-j|0;if(m-1>>>0<255){break ja}break j}j=m-192|0;if(j>>>0<=413){j=L[(L[j+94240|0]+a|0)+344|0]&1<<l;break ia}if(m>>>0>255){break j}}j=L[(a+m|0)+344|0]&1<<l}if(!j){break j}k=(k-i|0)+1|0;m=((l|0)==2?19:20)-x|0;break ca;case 8:c=s+2|0;i=I[s+1|0];i=K[((((i|0)<65?191:-65)+i<<2)+a|0)+4788>>2];if(!i){break j}ka:{while(1){r=L[i|0];if((r|0)==7){break j}if((r|0)==126){t=0;break ka}j=k;la:{t=Ba(i);s=t-1|0;ma:{if((s|0)>0){j=l-t|0;m=0;n=k;while(1){n=n-1|0;if(!L[n|0]){break ma}m=m+1|0;if((s|0)!=(m|0)){continue}break}}m=L[j|0];na:{if((m|0)!=(r|0)|!m){break na}while(1){i=i+1|0;r=L[i|0];j=j+1|0;m=L[j|0];if((r|0)!=(m|0)){break na}if(m){continue}break}}if(!r){break la}}j=i;while(1){m=L[j|0];i=j+1|0;j=i;if(m){continue}break}continue}break}if((t|0)<0){break j}}m=20-v|0;k=(k-t|0)+1|0;break ca;case 15:j=K[p+268>>2];l=K[a+604>>2];oa:{pa:{if(l){l=(Ta(l,j)|0)!=0;break pa}l=K[a+600>>2];qa:{if((l|0)>0){j=j-l|0;if(j-1>>>0<255){break qa}break oa}l=j-192|0;if(l>>>0<=413){l=I[(L[l+94240|0]+a|0)+344|0]&1;break pa}if(j>>>0>255){break oa}}l=I[(a+j|0)+344|0]&1}if(l){break j}}m=20-x|0;k=(k-i|0)+1|0;break ca;case 1:if(K[p+268>>2]!=K[p+264>>2]){break j}m=21-x|0;k=(k-i|0)+1|0;break ca;case 5:l=K[p+268>>2];if(!(l-48>>>0<10|l-2406>>>0<10)){break j}m=21-x|0;k=(k-i|0)+1|0;break ca;case 6:if(uc(K[p+268>>2])){break j}m=21-v|0;k=(k-i|0)+1|0;break ca;case 18:c=s+2|0;j=L[s+1|0];if(!((j|0)==3|(j&240)==32)){break f}i=p+96|0;k=(K[b>>2]+(A+J|0)|0)+1|0;Fa(i,H,k);i=i+k|0;I[i|0]=32;I[i+1|0]=0;K[33265]=0;K[33266]=0;K[p+16>>2]=M;Wa(a,p+16|0,p+272|0,133060,0,0);m=23;n=K[33265];if(!((j|0)!=3|(n|0)>=0|K[33266]&16384)){break f}i=q;k=l;if(n>>>(j&15)&16384){break o}break j;case 11:j=1;if(L[c|0]==21){while(1){j=j+1|0;c=c+1|0;if(L[c|0]==21){continue}break}}if(K[a+8208>>2]<(j|0)){break j}m=(j-x|0)+18|0;break ca;case 0:m=19;i=q;k=l;if(K[a+8212>>2]>0){break o}break j;case 19:m=3;n=K[p+268>>2];if((n|0)==32){break ca}j=(k-i|0)+1|0;while(1){i=K[a+632>>2];ra:{sa:{if(i){i=(Ta(i,n)|0)!=0;break sa}i=K[a+600>>2];ta:{if((i|0)>0){n=n-i|0;if(n-1>>>0<255){break ta}break ra}i=n-192|0;if(i>>>0<=413){i=L[(L[i+94240|0]+a|0)+344|0]&128;break sa}if(n>>>0>255){break ra}}i=L[(a+n|0)+344|0]&128}if(i){break j}}j=j-mc(p+268|0,j-1|0)|0;n=K[p+268>>2];if((n|0)!=32){continue}break};break ca;case 16:m=1;i=q;k=l;if(K[a+8184>>2]){break o}break j;case 9:m=1;i=q;k=l;if(V){break o}break j;case 36:while(1){m=50;i=q;l=(r&255)-32|0;if(!l){break j}if((l|0)==14){break o}u=u-1|0;r=L[u|0];continue};case 35:break ha;default:break da}}i=r-32|0;ua:{if(i){if((i|0)==13){break ua}else{break j}}if(!W){break j}}m=22-v|0;break ca}va:{while(1){t=-1;n=l;l=l-1|0;wa:{if((B|0)!=18){break wa}i=I[s+2|0];m=K[((((i|0)<65?191:-65)+i<<2)+a|0)+4788>>2];if(!m){break wa}aa=n+1|0;while(1){u=L[m|0];if((u|0)==7){t=-1;break wa}if((u|0)==126){t=0;break wa}j=n;t=Ba(m);O=t-1|0;xa:{if((O|0)>0){j=aa-t|0;r=0;i=n;while(1){i=i-1|0;if(!L[i|0]){break xa}r=r+1|0;if((O|0)!=(r|0)){continue}break}}i=L[j|0];ya:{if((i|0)!=(u|0)|!i){break ya}while(1){m=m+1|0;u=L[m|0];j=j+1|0;i=L[j|0];if((u|0)!=(i|0)){break ya}if(i){continue}break}}if(!u){break wa}}j=m;while(1){i=L[j|0];m=j+1|0;j=m;if(i){continue}break}continue}}j=L[l|0];i=(j|0)==(B|0);if((j|0)==32|(j|0)==(B|0)){break va}if(!j){l=n;break ea}if((t|0)==-1){continue}break}l=n;break ea}l=n}k=i?l:k}m=0;k=(t|0)<0?k:l+1|0;break ca}if((j|0)!=(r|0)){break j}m=4;if((j|0)==32){break ca}m=(j&192)!=128?21-x|0:0}i=q;break o}if((j|0)!=(r|0)){break j}n=(j&192)!=128?21-v|0:0;break i}m=1;if(U){break j}}w=m+w|0;continue}i=I[s+1|0];q=L[s+3|0];k=L[s+2|0];if(!(K[a+8208>>2]|k&4)&(I[a+84|0]&1)){break j}c=s+4|0;n=0;q=q&127|((k&127)<<8|i<<16);break i}za:{j=K[b>>2]+d|0;if(u>>>0<=j>>>0){break za}while(1){if(L[j|0]!=101){i=j>>>0<o>>>0;j=j+1|0;if(i){continue}break za}break}n=0;z=j;break i}n=0;break i}m=-20;break f}r=0;j=K[p+268>>2];if((j|0)!=32){n=o+t|0;m=0;while(1){if(!m){k=K[a+632>>2];Aa:{Ba:{if(k){j=(Ta(k,j)|0)!=0;break Ba}k=K[a+600>>2];Ca:{if((k|0)>0){j=j-k|0;if(j-1>>>0<255){break Ca}break Aa}k=j-192|0;if(k>>>0<=413){j=L[(L[k+94240|0]+a|0)+344|0]&128;break Ba}if(j>>>0>255){break Aa}}j=L[(a+j|0)+344|0]&128}if(!j){break Aa}r=r+1|0}j=K[p+268>>2]}k=K[a+632>>2];Da:{if(k){m=(Ta(k,j)|0)!=0;break Da}k=K[a+600>>2];Ea:{if((k|0)>0){m=0;j=j-k|0;if(j-1>>>0<255){break Ea}break Da}k=j-192|0;if(k>>>0<=413){m=L[(L[k+94240|0]+a|0)+344|0]&128;break Da}m=0;if(j>>>0>255){break Da}}m=L[(a+j|0)+344|0]&128}n=Ga(p+268|0,n)+n|0;j=K[p+268>>2];if((j|0)!=32){continue}break}}if((i|0)>(r|0)){break j}n=(i-v|0)+18|0;break i}while(1){i=L[c|0];e=c+1|0;c=e;if(i){continue}break}if(L[e|0]!=7){continue e}a=d+$|0;K[b>>2]=K[b>>2]+(a?a:1);if(G){break b}break c}i=q;o=u;k=l;w=n+w|0;continue}o=o+t|0;m=21-v|0;break f}o=o+t|0;m=20-v|0}i=q;k=l;w=m+w|0;continue}}}E=86135}K[f+12>>2]=Z;K[f+8>>2]=_;K[f+4>>2]=E;K[f>>2]=G}sa=p+384|0}function Lb(a,b){var c=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0;c=sa-1168|0;sa=c;K[c+928>>2]=0;K[c+932>>2]=0;K[c+920>>2]=0;K[c+924>>2]=0;K[c+912>>2]=0;K[c+916>>2]=0;K[c+904>>2]=0;K[c+908>>2]=0;K[c+896>>2]=0;K[c+900>>2]=0;a:{b:{if(a){if(L[a|0]|b&8){break b}break a}if(!(b&8)){break a}}La(c+1088|0,a,40);c:{if(b&16){if((vb(Ca(c+704|0,a))|0)<=0){break a}p=b&8;break c}p=b&8;if(!(p|L[c+1088|0])){J[c+1088>>1]=L[85055]|L[85056]<<8;I[c+1090|0]=L[85057]}K[c+496>>2]=137584;K[c+500>>2]=47;K[c+504>>2]=47;d=c+512|0;Aa(d,85286,c+496|0);K[c+484>>2]=c+1088;K[c+480>>2]=d;d=c+704|0;Aa(d,85425,c+480|0);if((vb(d)|0)>0){break c}K[c+468>>2]=47;K[c+472>>2]=47;K[c+464>>2]=137584;d=c+512|0;Aa(d,85648,c+464|0);K[c+452>>2]=c+1088;K[c+448>>2]=d;Aa(c+704|0,85425,c+448|0)}e=p?86012:85055;q=Cb(c+704|0,85712);if(!q){d=0;if(b&3){break a}d=c+1088|0;e=(kc(d)|0)<0?e:d}o=b&2;d:{if(o){break d}d=K[47192];if(!d){break d}Se(d);K[47192]=0}t=Ca(c+992|0,e);s=Ca(c+944|0,e);e:{if(!o){K[32972]=199592;La(200992,a,40);I[201088]=0;I[201040]=0;K[50299]=200992;K[50298]=201088;K[50297]=201040;break e}d=mb(200992,43);if(d){I[d|0]=0}K[c+432>>2]=a+3;a=c+704|0;Aa(a,86030,c+432|0);Za(200992,a)}Oe(o);if(q){v=K[30450];w=c+548|0;x=c+544|0;y=c+540|0;z=c+536|0;A=c+532|0;B=c+528|0;a=c+512|0;C=a|12;D=a|8;E=a|4;while(1){if(vc(c+704|0,190,q)){a=c+704|0;f:{if(L[c+704|0]!=35){a=Ba(c+704|0)-1|0;g:{if((a|0)<=0){break g}while(1){d=(c+704|0)+a|0;e=I[d|0];if(!((e|0)==32|e-9>>>0<5)){break g}I[d|0]=0;a=a-1|0;if((a|0)>0){continue}break}}a=ke(c+704|0);if(!a){break f}}I[a|0]=0}a=c+704|0;d=L[c+704|0];h:{if(!d){break h}while(1){d=d<<24>>24;if((d|0)==32|d-9>>>0<5){break h}a=a+1|0;d=L[a|0];if(d){continue}break}}I[a|0]=0;if(!L[c+704|0]){continue}a=a+1|0;d=ub(129744,c+704|0);if(d){f=0;e=sa-416|0;sa=e;g=K[47192];i:{if(!g){K[e>>2]=$b(129568,d);Na(K[30450],89101,e);break i}j:{switch(d-19|0){case 16:K[e+32>>2]=e+412;if((Ka(a,84249,e+32|0)|0)!=1){break i}K[g+324>>2]=K[e+412>>2];break i;case 8:Ne(a,g+320|0,27);break i;case 2:K[e+48>>2]=188784;Ka(a,84249,e+48|0);a=L[188784];if(!a){break i}K[g+152>>2]=a;break i;case 11:if(L[a|0]){h=K[30450];while(1){d=a;a=a+1|0;f=I[d|0];if((f|0)==32|f-9>>>0<5){continue}f=Kb(d);K[e+412>>2]=f;if((f|0)>0){k:{if(f>>>0<=31){K[g+104>>2]=K[g+104>>2]|1<<f;break k}if(f>>>0<=63){K[g+108>>2]=K[g+108>>2]|1<<f-32;break k}K[e+64>>2]=f;Na(h,84700,e- -64|0)}d=a}while(1){a=d;d=a+1|0;f=I[a|0];if(f-48>>>0<10|(f|32)-97>>>0<26){continue}break}if(f){continue}break}}a=K[g+104>>2];if(a&8){K[g+124>>2]=46;K[g+128>>2]=44}if(a&4){K[g+124>>2]=0}break i;default:if((d&65280)!=256){break i}K[e+16>>2]=(g+((d&255)<<2)|0)+24;Ka(a,84249,e+16|0);break i;case 1:K[e+144>>2]=g;K[e+148>>2]=g+4;Ka(a,85642,e+144|0);break i;case 3:d=0;f=e+160|0;Ea(f,0,240);K[e+132>>2]=e+360;K[e+128>>2]=e+320;K[e+124>>2]=e+280;K[e+120>>2]=e+240;K[e+116>>2]=e+200;K[e+112>>2]=f;f=Ka(a,85037,e+112|0);K[e+412>>2]=f;K[g+152>>2]=0;if((f|0)<=0){break i}k=K[30450];while(1){h=(e+160|0)+Q(d,40)|0;l:{if(!Oa(h,85301)){break l}m:{j=K[34454];if((j|0)>0){n=K[34455];a=0;while(1){if(!Oa(h,n+Q(a,68)|0)){break m}a=a+1|0;if((j|0)!=(a|0)){continue}break}}K[e+96>>2]=h;Na(k,85562,e+96|0);f=K[e+412>>2];break l}I[(d+g|0)+156|0]=a}d=d+1|0;if((f|0)>(d|0)){continue}break};break i;case 9:K[e+88>>2]=g+20;K[e+84>>2]=g+16;K[e+80>>2]=g+8;Ka(a,84778,e+80|0);break i;case 10:Ne(a,g+12|0,29);break i;case 5:k=ld(a,e+160|0);if((k|0)<=0){break i}d=0;a=0;if(k>>>0>=4){n=k&-4;h=g+304|0;while(1){j=e+160|0;J[h+(a<<1)>>1]=K[j+(a<<2)>>2];i=a|1;J[h+(i<<1)>>1]=K[j+(i<<2)>>2];i=a|2;J[h+(i<<1)>>1]=K[j+(i<<2)>>2];i=a|3;J[h+(i<<1)>>1]=K[j+(i<<2)>>2];a=a+4|0;f=f+4|0;if((n|0)!=(f|0)){continue}break}}f=k&3;if(!f){break i}while(1){J[(g+(a<<1)|0)+304>>1]=K[(e+160|0)+(a<<2)>>2];a=a+1|0;d=d+1|0;if((f|0)!=(d|0)){continue}break};break i;case 6:k=ld(a,e+160|0);if((k|0)<=0){break i}d=0;a=0;if(k>>>0>=4){n=k&-4;h=g+296|0;while(1){j=e+160|0;I[a+h|0]=K[j+(a<<2)>>2];i=a|1;I[i+h|0]=K[j+(i<<2)>>2];i=a|2;I[i+h|0]=K[j+(i<<2)>>2];i=a|3;I[i+h|0]=K[j+(i<<2)>>2];a=a+4|0;f=f+4|0;if((n|0)!=(f|0)){continue}break}}f=k&3;if(!f){break i}while(1){I[(a+g|0)+296|0]=K[(e+160|0)+(a<<2)>>2];a=a+1|0;d=d+1|0;if((f|0)!=(d|0)){continue}break};break i;case 7:k=ld(a,e+160|0);if((k|0)<=0){break i}d=0;a=0;if(k>>>0>=4){n=k&-4;h=g+304|0;while(1){j=h+(a<<1)|0;i=j;l=M[j>>1];j=e+160|0;J[i>>1]=l+M[j+(a<<2)>>1];i=a|1;l=h+(i<<1)|0;J[l>>1]=M[l>>1]+M[j+(i<<2)>>1];i=a|2;l=h+(i<<1)|0;J[l>>1]=M[l>>1]+M[j+(i<<2)>>1];i=a|3;l=h+(i<<1)|0;J[l>>1]=M[l>>1]+M[j+(i<<2)>>1];a=a+4|0;f=f+4|0;if((n|0)!=(f|0)){continue}break}}f=k&3;if(!f){break i}while(1){h=g+(a<<1)|0;J[h+304>>1]=M[h+304>>1]+M[(e+160|0)+(a<<2)>>1];a=a+1|0;d=d+1|0;if((f|0)!=(d|0)){continue}break};break i;case 4:I[g+169|0]=1;break i;case 0:break j}}I[g+208|0]=1}sa=e+416|0;continue}n:{switch(ub(131904,c+704|0)-1|0){case 1:if(o){continue}I[c+1040|0]=0;K[c+512>>2]=5;K[c+32>>2]=c+1040;K[c+36>>2]=c+512;Ka(a,86237,c+32|0);if(K[c+1040>>2]==1769103734&K[c+1044>>2]==7630433){continue}a=Ba(c+1040|0)+2|0;if(a>>>0<99-r>>>0){d=r+201088|0;I[d|0]=K[c+512>>2];Ca(d+1|0,c+1040|0);r=a+r|0}if(!F){a=0;h=c+1040|0;d=h;o:{if(!d){d=K[57150];if(!d){break o}}a=86875;e=sa-32|0;K[e+24>>2]=0;K[e+28>>2]=0;K[e+16>>2]=0;K[e+20>>2]=0;K[e+8>>2]=0;K[e+12>>2]=0;K[e>>2]=0;K[e+4>>2]=0;f=L[86875];g=0;p:{if(!f){break p}if(!L[86876]){a=d;while(1){e=a;a=a+1|0;if(L[e|0]==(f|0)){continue}break}g=e-d|0;break p}while(1){g=e+(f>>>3&28)|0;K[g>>2]=K[g>>2]|1<<f;f=L[a+1|0];a=a+1|0;if(f){continue}break}a=d;f=L[a|0];q:{if(!f){break q}while(1){if(!(K[e+(f>>>3&28)>>2]>>>f&1)){break q}f=L[a+1|0];a=a+1|0;if(f){continue}break}}g=a-d|0}a=g+d|0;if(!L[a|0]){K[57150]=0;a=0;break o}d=86875;f=sa-32|0;sa=f;e=I[86875];r:{if(!(L[86876]?e:0)){d=_c(a,e);break r}Ea(f,0,32);e=L[86875];if(e){while(1){g=f+(e>>>3&28)|0;K[g>>2]=K[g>>2]|1<<e;e=L[d+1|0];d=d+1|0;if(e){continue}break}}d=a;e=L[a|0];if(!e){break r}while(1){if(K[f+(e>>>3&28)>>2]>>>e&1){break r}e=L[d+1|0];d=d+1|0;if(e){continue}break}}sa=f+32|0;d=(d-a|0)+a|0;if(L[d|0]){K[57150]=d+1;I[d|0]=0;break o}K[57150]=0}d=Ca(t,a);Ca(s,a);kc(Ca(c+896|0,a));K[47192]=nd(d);La(K[32972]+40|0,h,20)}F=1;continue;case 0:if(o){continue}while(1){d=a;a=a+1|0;e=I[d|0];if((e|0)==32|e-9>>>0<5){continue}break};La(201040,d,40);continue;case 2:K[c+1152>>2]=0;d=c+512|0;K[c+48>>2]=d;K[c+52>>2]=c+1152;Ka(a,86237,c+48|0);I[201200]=ub(132112,d);I[201201]=K[c+1152>>2];continue;case 4:K[c+64>>2]=s;Ka(a,86939,c- -64|0);continue;case 3:K[c+80>>2]=c+896;Ka(a,86939,c+80|0);continue;case 8:K[c+1152>>2]=100;K[c+1164>>2]=100;K[c+1148>>2]=100;K[c+112>>2]=c+1144;K[c+1144>>2]=0;K[c+96>>2]=c+512;K[c+100>>2]=c+1152;K[c+104>>2]=c+1164;K[c+108>>2]=c+1148;if((Ka(a,91156,c+96|0)|0)<2){continue}a=K[c+512>>2];if(a>>>0>8){continue}d=K[c+1152>>2];if((d|0)>=0){e=K[32972]+(a<<1)|0;m=+(d|0)*2.56001;s:{if(S(m)<2147483648){d=~~m;break s}d=-2147483648}J[e+236>>1]=d;J[e+164>>1]=d}d=K[c+1164>>2];if((d|0)>=0){e=K[32972]+(a<<1)|0;m=+(d|0)*2.56001;t:{if(S(m)<2147483648){d=~~m;break t}d=-2147483648}J[e+254>>1]=d;J[e+182>>1]=d}e=K[c+1148>>2];u:{if((e|0)<0){d=K[32972];break u}d=K[32972];h=d+(a<<1)|0;m=+(e|0)*2.56001;v:{if(S(m)<2147483648){e=~~m;break v}e=-2147483648}J[h+200>>1]=e}J[((a<<1)+d|0)+218>>1]=K[c+1144>>2];if(a){continue}J[d+200>>1]=(Q(J[d+200>>1],105)|0)/100;continue;case 9:K[c+132>>2]=c+696;K[c+128>>2]=c+700;if((Ka(a,87106,c+128|0)|0)!=2){continue}a=K[32972];d=K[c+700>>2];K[a+64>>2]=(d<<12)-36864;K[a+68>>2]=Q(K[c+696>>2]-d|0,108);m=(+(d-82|0)/82*.25+1)*256;if(S(m)<2147483648){K[a+116>>2]=~~m;continue}K[a+116>>2]=-2147483648;continue;case 35:if(!G){kc(c+896|0)}K[c+1164>>2]=0;I[c+1156|0]=L[91267];K[c+1152>>2]=L[91263]|L[91264]<<8|(L[91265]<<16|L[91266]<<24);K[c+144>>2]=c+1164;K[c+148>>2]=c+512;K[c+152>>2]=c+1152;w:{if((Ka(a,91302,c+144|0)|0)<2|K[49848]>59){break w}a=We(c+512|0);if(!a){break w}I[Q(K[49848],3)+199408|0]=a;a=We(c+1152|0);d=K[49848];e=Q(d,3)+199408|0;I[e+1|0]=a;K[49848]=d+1;I[e+2|0]=K[c+1164>>2]}G=1;continue;case 10:K[c+1140>>2]=0;d=K[32972];K[d+100>>2]=0;K[c+164>>2]=d+100;K[c+160>>2]=d+96;Ka(a,87106,c+160|0);continue;case 11:K[c+176>>2]=c+1140;if((Ka(a,87268,c+176|0)|0)!=1){continue}K[K[32972]+88>>2]=K[c+1140>>2]<<5;continue;case 12:K[c+192>>2]=c+1140;if((Ka(a,87268,c+192|0)|0)!=1){continue}K[K[32972]+92>>2]=K[c+1140>>2];continue;case 13:K[c+208>>2]=c+1140;if((Ka(a,87268,c+208|0)|0)!=1){continue}d=K[32972];a=K[c+1140>>2];if((a|0)>=5){K[d+108>>2]=1;K[c+1140>>2]=4;a=4}K[d+104>>2]=a+1;continue;case 14:K[c+552>>2]=-1;K[c+556>>2]=-1;K[c+544>>2]=-1;K[c+548>>2]=-1;K[c+536>>2]=-1;K[c+540>>2]=-1;K[c+528>>2]=-1;K[c+532>>2]=-1;K[c+240>>2]=B;K[c+244>>2]=A;K[c+248>>2]=z;K[c+252>>2]=y;K[c+256>>2]=x;K[c+260>>2]=w;K[c+520>>2]=-1;K[c+524>>2]=-1;K[c+512>>2]=-1;K[c+516>>2]=-1;K[c+228>>2]=E;K[c+232>>2]=D;K[c+236>>2]=C;K[c+224>>2]=c+512;Ka(a,84222,c+224|0);n=K[32972];a=0;f=K[c+516>>2];e=0;while(1){d=e;g=f;h=a;a=a<<2;f=a+(c+512|0)|0;e=K[f>>2];x:{if((e|0)!=-1){break x}e=8e3;K[f>>2]=8e3;if(!h){break x}K[(c+512|0)+(a|4)>>2]=K[(a+c|0)+508>>2]}f=K[(c+512|0)+(a|4)>>2];e=(e|0)/8|0;y:{if((d|0)>=(e|0)){break y}j=e-d|0;if((j|0)<=0){break y}k=d+1|0;a=d;if(j&1){I[(d+n|0)+344|0]=(g|0)>=255?255:g;a=k}if((e|0)==(k|0)){break y}k=f-g|0;while(1){l=n+344|0;i=g+((Q(k,a-d|0)|0)/(j|0)|0)|0;I[l+a|0]=(i|0)>=255?255:i;u=a+1|0;i=g+((Q(k,u-d|0)|0)/(j|0)|0)|0;I[l+u|0]=(i|0)>=255?255:i;a=a+2|0;if((e|0)!=(a|0)){continue}break}}a=h+2|0;if(h>>>0<10){continue}break};continue;case 15:K[c+272>>2]=c+1140;if((Ka(a,87268,c+272|0)|0)!=1){continue}K[K[32972]+112>>2]=(K[c+1140>>2]<<6)/100;continue;case 16:d=K[32972];e=d+300|0;K[e>>2]=0;K[e+4>>2]=0;f=d+292|0;K[f>>2]=0;K[f+4>>2]=0;g=d+284|0;K[g>>2]=0;K[g+4>>2]=0;h=d+276|0;K[h>>2]=0;K[h+4>>2]=0;K[c+316>>2]=d+304;K[c+312>>2]=e;K[c+308>>2]=d+296;K[c+304>>2]=f;K[c+300>>2]=d+288;K[c+296>>2]=g;K[c+292>>2]=d+280;K[c+288>>2]=h;d=Ka(a,84553,c+288|0);a=K[32972];K[a+272>>2]=d;K[a+276>>2]=0-K[a+276>>2];K[a+284>>2]=0-K[a+284>>2];K[a+292>>2]=0-K[a+292>>2];K[a+300>>2]=0-K[a+300>>2];continue;case 17:d=K[32972];e=d+336|0;K[e>>2]=0;K[e+4>>2]=0;f=d+328|0;K[f>>2]=0;K[f+4>>2]=0;g=d+320|0;K[g>>2]=0;K[g+4>>2]=0;h=d+312|0;K[h>>2]=0;K[h+4>>2]=0;K[c+348>>2]=d+340;K[c+344>>2]=e;K[c+340>>2]=d+332;K[c+336>>2]=f;K[c+332>>2]=d+324;K[c+328>>2]=g;K[c+324>>2]=d+316;K[c+320>>2]=h;a=Ka(a,84553,c+320|0);K[K[32972]+308>>2]=a;continue;case 36:d=K[32972];K[c+352>>2]=d+120;K[c+356>>2]=d+124;K[c+1140>>2]=Ka(a,87106,c+352|0);continue;case 33:K[c+368>>2]=K[32972]+84;Ka(a,87268,c+368|0);Hc(3);continue;case 31:d=K[32972];e=d+156|0;K[e>>2]=0;K[e+4>>2]=0;f=d+148|0;K[f>>2]=0;K[f+4>>2]=0;g=d+140|0;K[g>>2]=0;K[g+4>>2]=0;h=d+132|0;K[h>>2]=0;K[h+4>>2]=0;K[c+412>>2]=d+160;K[c+408>>2]=e;K[c+404>>2]=d+152;K[c+400>>2]=f;K[c+396>>2]=d+144;K[c+392>>2]=g;K[c+388>>2]=d+136;K[c+384>>2]=h;Ka(a,84553,c+384|0);a=K[32972];K[a+152>>2]=K[a+152>>2]-40;continue;case 32:K[c+416>>2]=145740;Ka(a,87268,c+416|0);Hc(3);continue;case 6:case 7:continue;default:break n}}K[c+16>>2]=c+704;Na(v,87359,c+16|0);continue}break}_a(q)}a=K[47192];z:{A:{if(!(a|o)){a=nd(t);K[47192]=a;break A}if(o){break z}}B:{if(!p){a=kc(c+896|0);if((a|0)<0){K[c>>2]=c+896;Na(K[30450],87567,c);a=0}K[K[32972]+60>>2]=a;d=K[47192];K[d+292>>2]=a;Od(d,s,b&4);if(L[132848]){break B}Se(K[47192]);d=0;break a}K[K[32972]+60>>2]=0;K[a+292>>2]=0}I[r+201088|0]=0}d=K[32972]}sa=c+1168|0;return d}function Ka(a,b,c){var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0;x=sa-16|0;sa=x;K[x+12>>2]=c;d=sa-144|0;sa=d;e=Ea(d,0,144);K[e+76>>2]=-1;K[e+44>>2]=a;K[e+32>>2]=18;K[e+84>>2]=a;d=b;v=c;a=0;j=sa-304|0;sa=j;a:{b:{c:{d:{if(K[e+4>>2]){break d}fd(e);if(K[e+4>>2]){break d}break c}b=L[d|0];if(!b){break a}e:{f:{g:{h:{while(1){i:{b=b&255;j:{if((b|0)==32|b-9>>>0<5){while(1){b=d;d=d+1|0;c=L[b+1|0];if((c|0)==32|c-9>>>0<5){continue}break}lb(e,0,0);while(1){c=K[e+4>>2];k:{if((c|0)!=K[e+104>>2]){K[e+4>>2]=c+1;c=L[c|0];break k}c=Ia(e)}if((c|0)==32|c-9>>>0<5){continue}break}d=K[e+4>>2];c=K[e+116>>2];if((c|0)>0|(c|0)>=0){d=d-1|0;K[e+4>>2]=d}c=d-K[e+44>>2]|0;d=c;i=q+K[e+124>>2]|0;f=c>>31;c=n+K[e+120>>2]|0;i=f+(c>>>0<n>>>0?i+1|0:i)|0;n=c+d|0;q=n>>>0<c>>>0?i+1|0:i;break j}l:{m:{n:{if(L[d|0]==37){b=L[d+1|0];if((b|0)==42){break n}if((b|0)!=37){break m}}lb(e,0,0);o:{if(L[d|0]==37){while(1){b=K[e+4>>2];p:{if((b|0)!=K[e+104>>2]){K[e+4>>2]=b+1;b=L[b|0];break p}b=Ia(e)}if((b|0)==32|b-9>>>0<5){continue}break}d=d+1|0;break o}b=K[e+4>>2];if((b|0)!=K[e+104>>2]){K[e+4>>2]=b+1;b=L[b|0];break o}b=Ia(e)}if(L[d|0]!=(b|0)){c=K[e+116>>2];if((c|0)>0|(c|0)>=0){K[e+4>>2]=K[e+4>>2]-1}if((b|0)>=0){break a}g=0;if(w){break a}break c}b=K[e+4>>2]-K[e+44>>2]|0;f=b;h=f>>31;b=q+K[e+124>>2]|0;c=n+K[e+120>>2]|0;g=(c>>>0<n>>>0?b+1|0:b)+h|0;n=c+f|0;q=n>>>0<c>>>0?g+1|0:g;b=d;break j}k=0;b=d+2|0;break l}if(!(L[d+2|0]!=36|b-48>>>0>=10)){b=L[d+1|0]-48|0;c=sa-16|0;K[c+12>>2]=v;b=(b>>>0>1?(b<<2)-4|0:0)+v|0;K[c+8>>2]=b+4;k=K[b>>2];b=d+3|0;break l}k=K[v>>2];v=v+4|0;b=d+1|0}l=0;d=0;if(L[b|0]-48>>>0<10){while(1){d=(L[b|0]+Q(d,10)|0)-48|0;c=L[b+1|0];b=b+1|0;if(c-48>>>0<10){continue}break}}o=L[b|0];if((o|0)==109){m=0;l=(k|0)!=0;o=L[b+1|0];a=0;b=b+1|0}c=b;b=c+1|0;f=3;g=l;q:{r:{switch(o-65|0){case 39:f=c+2|0;c=L[c+1|0]==104;b=c?f:b;f=c?-2:-1;break q;case 43:f=c+2|0;c=L[c+1|0]==108;b=c?f:b;f=c?3:1;break q;case 51:case 57:f=1;break q;case 11:f=2;break q;case 41:break q;case 0:case 2:case 4:case 5:case 6:case 18:case 23:case 26:case 32:case 34:case 35:case 36:case 37:case 38:case 40:case 45:case 46:case 47:case 50:case 52:case 55:break r;default:break e}}f=0;b=c}g=f;c=L[b|0];f=(c&47)==3;t=f?1:g;s=f?c|32:c;s:{if((s|0)==91){break s}t:{if((s|0)!=110){if((s|0)!=99){break t}d=(d|0)<=1?1:d;break s}$d(k,t,n,q);break j}lb(e,0,0);while(1){c=K[e+4>>2];u:{if((c|0)!=K[e+104>>2]){K[e+4>>2]=c+1;c=L[c|0];break u}c=Ia(e)}if((c|0)==32|c-9>>>0<5){continue}break}c=K[e+4>>2];f=K[e+116>>2];if((f|0)>0|(f|0)>=0){c=c-1|0;K[e+4>>2]=c}c=c-K[e+44>>2]|0;f=c;i=q+K[e+124>>2]|0;g=c>>31;c=n+K[e+120>>2]|0;q=g+(c>>>0<n>>>0?i+1|0:i)|0;n=c+f|0;q=n>>>0<c>>>0?q+1|0:q}p=d;r=d>>31;lb(e,d,r);c=K[e+4>>2];v:{if((c|0)!=K[e+104>>2]){K[e+4>>2]=c+1;break v}if((Ia(e)|0)<0){break f}}c=K[e+116>>2];if((c|0)>0|(c|0)>=0){K[e+4>>2]=K[e+4>>2]-1}c=16;w:{x:{y:{z:{A:{switch(s-88|0){default:c=s-65|0;if(c>>>0>6|!(1<<c&113)){break w}case 9:case 13:case 14:case 15:be(j+8|0,e,t,0);c=K[e+4>>2]-K[e+44>>2]|0;if(K[e+120>>2]!=(0-c|0)|K[e+124>>2]!=(0-((c>>31)+((c|0)!=0)|0)|0)){break y}break g;case 3:case 11:case 27:if((s|16)==115){Ea(j+32|0,-1,257);I[j+32|0]=0;if((s|0)!=115){break x}I[j+65|0]=0;I[j+46|0]=0;J[j+42>>1]=0;J[j+44>>1]=0;break x}f=L[b+1|0];h=(f|0)==94;Ea(j+32|0,h,257);I[j+32|0]=0;c=h?b+2|0:b+1|0;B:{C:{D:{b=L[(h?2:1)+b|0];if((b|0)!=45){if((b|0)==93){break D}f=(f|0)!=94;b=c;break B}f=(f|0)!=94;I[j+78|0]=f;break C}f=(f|0)!=94;I[j+126|0]=f}b=c+1|0}while(1){c=L[b|0];E:{if((c|0)!=45){if(!c){break f}if((c|0)==93){break x}break E}c=45;h=L[b+1|0];if(!h|(h|0)==93){break E}g=b+1|0;b=L[b-1|0];F:{if(h>>>0<=b>>>0){c=h;break F}while(1){b=b+1|0;I[b+(j+32|0)|0]=f;c=L[g|0];if(c>>>0>b>>>0){continue}break}}b=g}I[(c+j|0)+33|0]=f;b=b+1|0;continue};case 23:c=8;break z;case 12:case 29:c=10;break z;case 1:case 2:case 4:case 5:case 6:case 7:case 8:case 10:case 16:case 18:case 19:case 20:case 21:case 22:case 25:case 26:case 28:case 30:case 31:break w;case 0:case 24:case 32:break z;case 17:break A}}c=0}h=0;i=0;f=0;g=0;o=0;u=sa-16|0;sa=u;G:{if(!((c|0)!=1&c>>>0<=36)){K[56798]=28;break G}while(1){d=K[e+4>>2];H:{if((d|0)!=K[e+104>>2]){K[e+4>>2]=d+1;d=L[d|0];break H}d=Ia(e)}if((d|0)==32|d-9>>>0<5){continue}break}I:{J:{switch(d-43|0){case 0:case 2:break J;default:break I}}o=(d|0)==45?-1:0;d=K[e+4>>2];if((d|0)!=K[e+104>>2]){K[e+4>>2]=d+1;d=L[d|0];break I}d=Ia(e)}K:{L:{M:{N:{if(!((c|0)!=0&(c|0)!=16|(d|0)!=48)){d=K[e+4>>2];O:{if((d|0)!=K[e+104>>2]){K[e+4>>2]=d+1;d=L[d|0];break O}d=Ia(e)}if((d&-33)==88){c=16;d=K[e+4>>2];P:{if((d|0)!=K[e+104>>2]){K[e+4>>2]=d+1;d=L[d|0];break P}d=Ia(e)}if(L[d+121329|0]<16){break M}c=K[e+116>>2];if((c|0)>0|(c|0)>=0){K[e+4>>2]=K[e+4>>2]-1}lb(e,0,0);break G}if(c){break N}c=8;break M}c=c?c:10;if(c>>>0>L[d+121329|0]){break N}c=K[e+116>>2];if((c|0)>0|(c|0)>=0){K[e+4>>2]=K[e+4>>2]-1}lb(e,0,0);K[56798]=28;break G}if((c|0)!=10){break M}f=d-48|0;if(f>>>0<=9){c=0;while(1){c=Q(c,10)+f|0;g=c>>>0<429496729;d=K[e+4>>2];Q:{if((d|0)!=K[e+104>>2]){K[e+4>>2]=d+1;d=L[d|0];break Q}d=Ia(e)}f=d-48|0;if(g&f>>>0<=9){continue}break}h=c}R:{if(f>>>0>9){break R}c=vg(h,0,10,0);g=va;while(1){i=g;h=c+f|0;i=h>>>0<f>>>0?i+1|0:i;g=(i|0)==429496729&h>>>0>=2576980378|i>>>0>429496729;c=K[e+4>>2];S:{if((c|0)!=K[e+104>>2]){K[e+4>>2]=c+1;d=L[c|0];break S}d=Ia(e)}f=d-48|0;if(g|f>>>0>9){break R}c=vg(h,i,10,0);g=va;if((g|0)==-1&(f^-1)>>>0>=c>>>0|(g|0)!=-1){continue}break}c=10;break L}c=10;if(f>>>0<=9){break L}break K}if(c-1&c){g=L[d+121329|0];if(g>>>0<c>>>0){while(1){f=Q(c,f)+g|0;h=f>>>0<119304647;d=K[e+4>>2];T:{if((d|0)!=K[e+104>>2]){K[e+4>>2]=d+1;d=L[d|0];break T}d=Ia(e)}g=L[d+121329|0];if(h&g>>>0<c>>>0){continue}break}h=f}if(c>>>0<=g>>>0){break L}while(1){f=vg(h,i,c,0);p=va;g=g&255;if((p|0)==-1&(g^-1)>>>0<f>>>0){break L}i=p;h=f+g|0;i=h>>>0<g>>>0?i+1|0:i;d=K[e+4>>2];U:{if((d|0)!=K[e+104>>2]){K[e+4>>2]=d+1;d=L[d|0];break U}d=Ia(e)}g=L[d+121329|0];if(c>>>0<=g>>>0){break L}Ua(u,c,0,0,0,h,i,0,0);if(!(K[u+8>>2]|K[u+12>>2])){continue}break}break L}p=I[(Q(c,23)>>>5&7)+84400|0];f=L[d+121329|0];if(f>>>0<c>>>0){while(1){g=g<<p|f;h=g>>>0<134217728;d=K[e+4>>2];V:{if((d|0)!=K[e+104>>2]){K[e+4>>2]=d+1;d=L[d|0];break V}d=Ia(e)}f=L[d+121329|0];if(h&f>>>0<c>>>0){continue}break}h=g}if(c>>>0<=f>>>0){break L}r=p&31;if((p&63)>>>0>=32){g=0;r=-1>>>r|0}else{g=-1>>>r|0;r=g|(1<<r)-1<<32-r}if(!g&h>>>0>r>>>0){break L}while(1){y=f&255;f=h;d=p&31;if((p&63)>>>0>=32){i=f<<d;d=0}else{i=(1<<d)-1&f>>>32-d|i<<d;d=f<<d}h=y|d;d=K[e+4>>2];W:{if((d|0)!=K[e+104>>2]){K[e+4>>2]=d+1;d=L[d|0];break W}d=Ia(e)}f=L[d+121329|0];if(c>>>0<=f>>>0){break L}if((g|0)==(i|0)&h>>>0<=r>>>0|g>>>0>i>>>0){continue}break}}if(L[d+121329|0]>=c>>>0){break K}while(1){d=K[e+4>>2];X:{if((d|0)!=K[e+104>>2]){K[e+4>>2]=d+1;d=L[d|0];break X}d=Ia(e)}if(L[d+121329|0]<c>>>0){continue}break}K[56798]=68;o=0;h=-1;i=-1}c=K[e+116>>2];if((c|0)>0|(c|0)>=0){K[e+4>>2]=K[e+4>>2]-1}Y:{if((h&i)!=-1){break Y}}c=h^o;h=c-o|0;d=o>>31;i=(d^i)-((c>>>0<o>>>0)+d|0)|0}sa=u+16|0;c=K[e+4>>2]-K[e+44>>2]|0;if(K[e+120>>2]==(0-c|0)&K[e+124>>2]==(0-((c>>31)+((c|0)!=0)|0)|0)){break g}if(!(!k|(s|0)!=112)){K[k>>2]=h;break w}$d(k,t,h,i);break w}if(!k){break w}d=K[j+16>>2];c=K[j+20>>2];f=K[j+8>>2];l=K[j+12>>2];Z:{switch(t|0){case 0:i=sa-32|0;sa=i;h=c&2147483647;g=h-1065418752|0;p=h-1082064896|0;_:{if((g|0)==(p|0)&0|g>>>0<p>>>0){h=(c&33554431)<<7|d>>>25;g=0;p=g;d=d&33554431;if(!(!g&(d|0)==16777216?!(f|l):!g&d>>>0<16777216)){g=h+1073741825|0;break _}g=h+1073741824|0;if(d^16777216|f|(l|p)){break _}g=(h&1)+g|0;break _}if(!(!d&(h|0)==2147418112?!(f|l):h>>>0<2147418112)){g=((c&33554431)<<7|d>>>25)&4194303|2143289344;break _}g=2139095040;if(h>>>0>1082064895){break _}g=0;h=h>>>16|0;if(h>>>0<16145){break _}g=c&65535|65536;Xa(i+16|0,f,l,d,g,h-16129|0);Fb(i,f,l,d,g,16257-h|0);d=K[i+8>>2];g=(K[i+12>>2]&33554431)<<7|d>>>25;h=K[i>>2]|(K[i+16>>2]|K[i+24>>2]|(K[i+20>>2]|K[i+28>>2]))!=0;l=K[i+4>>2];f=0;d=d&33554431;if(!(!f&(d|0)==16777216?!(h|l):!f&d>>>0<16777216)){g=g+1|0;break _}if(d^16777216|h|(f|l)){break _}g=(g&1)+g|0}sa=i+32|0;K[k>>2]=c&-2147483648|g;break w;case 1:P[k>>3]=Wc(f,l,d,c);break w;case 2:break Z;default:break w}}K[k>>2]=f;K[k+4>>2]=l;K[k+8>>2]=d;K[k+12>>2]=c;break w}u=(s|0)!=99;f=u?31:d+1|0;$:{if((t|0)==1){c=k;if(l){c=Qa(f<<2);if(!c){break h}}K[j+296>>2]=0;K[j+300>>2]=0;d=0;while(1){a=c;aa:{while(1){c=K[e+4>>2];ba:{if((c|0)!=K[e+104>>2]){K[e+4>>2]=c+1;c=L[c|0];break ba}c=Ia(e)}if(!L[(c+j|0)+33|0]){break aa}I[j+27|0]=c;h=j+28|0;c=j+296|0;g=c?c:228604;c=K[g>>2];ca:{da:{m=j+27|0;ea:{fa:{if(!m){if(c){break fa}c=0;break ca}ga:{if(c){o=1;break ga}c=L[m|0];i=c<<24>>24;if((i|0)>=0){if(h){K[h>>2]=c}c=(i|0)!=0;break ca}if(!K[K[56841]>>2]){c=1;if(!h){break ea}K[h>>2]=i&57343;c=1;break ca}c=c-194|0;if(c>>>0>50){break fa}c=K[(c<<2)+124752>>2];break da}i=L[m|0];t=i>>>3|0;if((t-16|(c>>26)+t)>>>0>7){break fa}while(1){o=o-1|0;c=i-128|c<<6;if((c|0)>=0){K[g>>2]=0;if(h){K[h>>2]=c}c=1-o|0;break ca}if(!o){break da}m=m+1|0;i=L[m|0];if((i&192)==128){continue}break}}K[g>>2]=0;K[56798]=25;c=-1}break ca}K[g>>2]=c;c=-2}if((c|0)==-2){continue}m=0;if((c|0)==-1){break f}if(a){K[(d<<2)+a>>2]=K[j+28>>2];d=d+1|0}if(!l|(d|0)!=(f|0)){continue}break}g=1;f=f<<1|1;c=yb(a,f<<2);if(c){continue}break e}break}m=0;f=a;if(j+296|0?K[j+296>>2]:0){break f}break $}if(l){d=0;c=Qa(f);if(!c){break h}while(1){a=c;while(1){c=K[e+4>>2];ha:{if((c|0)!=K[e+104>>2]){K[e+4>>2]=c+1;c=L[c|0];break ha}c=Ia(e)}if(!L[(c+j|0)+33|0]){f=0;m=a;break $}I[a+d|0]=c;d=d+1|0;if((f|0)!=(d|0)){continue}break}g=1;f=f<<1|1;c=yb(a,f);if(c){continue}break}m=a;a=0;break e}d=0;if(k){while(1){a=K[e+4>>2];ia:{if((a|0)!=K[e+104>>2]){K[e+4>>2]=a+1;a=L[a|0];break ia}a=Ia(e)}if(L[(a+j|0)+33|0]){I[d+k|0]=a;d=d+1|0;continue}else{f=0;a=k;m=a;break $}}}while(1){a=K[e+4>>2];ja:{if((a|0)!=K[e+104>>2]){K[e+4>>2]=a+1;a=L[a|0];break ja}a=Ia(e)}if(L[(a+j|0)+33|0]){continue}break}a=0;m=0;f=0}c=K[e+4>>2];h=K[e+116>>2];if((h|0)>0|(h|0)>=0){c=c-1|0;K[e+4>>2]=c}h=c-K[e+44>>2]|0;c=h+K[e+120>>2]|0;i=K[e+124>>2]+(h>>31)|0;i=c>>>0<h>>>0?i+1|0:i;if(!(i|c)|!(u|(c|0)==(p|0)&(i|0)==(r|0))){break i}if(l){K[k>>2]=a}ka:{if((s|0)==99){break ka}if(f){K[(d<<2)+f>>2]=0}if(!m){m=0;break ka}I[d+m|0]=0}a=f}c=K[e+4>>2]-K[e+44>>2]|0;d=c;g=q+K[e+124>>2]|0;f=c>>31;c=n+K[e+120>>2]|0;q=f+(c>>>0<n>>>0?g+1|0:g)|0;n=c+d|0;q=n>>>0<c>>>0?q+1|0:q;w=((k|0)!=0)+w|0}d=b+1|0;b=L[b+1|0];if(b){continue}break a}break}a=f;break g}g=1;m=0;a=0;break e}g=l;break b}g=l}if(w){break b}}w=-1}if(!g){break a}Ha(m);Ha(a)}sa=j+304|0;sa=e+144|0;sa=x+16|0;return w}function Yf(){var a=0,b=0,c=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0;v=fb(20);K[v+16>>2]=0;K[v+8>>2]=175;K[v+12>>2]=50;a=K[33208];if(!a){s=sa-16|0;sa=s;a=sa-80|0;sa=a;b=ec(84292);a:{if(b){K[a+32>>2]=b;sb(137584,160,85959,a+32|0);if((vb(137584)|0)==-31){break a}K[a+16>>2]=b;sb(137584,160,86031,a+16|0);if((vb(137584)|0)==-31){break a}}b=ec(84619);if(b){K[a>>2]=b;sb(137584,160,85959,a);if((vb(137584)|0)==-31){break a}}b=L[84826]|L[84827]<<8|(L[84828]<<16|L[84829]<<24);K[34396]=L[84822]|L[84823]<<8|(L[84824]<<16|L[84825]<<24);K[34397]=b;J[68804]=L[84846]|L[84847]<<8;b=L[84842]|L[84843]<<8|(L[84844]<<16|L[84845]<<24);K[34400]=L[84838]|L[84839]<<8|(L[84840]<<16|L[84841]<<24);K[34401]=b;b=L[84834]|L[84835]<<8|(L[84836]<<16|L[84837]<<24);K[34398]=L[84830]|L[84831]<<8|(L[84832]<<16|L[84833]<<24);K[34399]=b}sa=a+80|0;K[s+12>>2]=0;d=s+12|0;g=sa-16|0;sa=g;K[g+12>>2]=22050;b:{if(qc(85144)){break b}if(qc(85315)){break b}if(qc(85473)){break b}qc(85698)}k=g+12|0;e=sa-16|0;sa=e;K[e+12>>2]=0;a=Gc(137832,84262,0,d);c:{if(a){break c}a=Gc(137836,84420,0,d);if(a){break c}a=Gc(137840,84813,0,d);if(a){break c}a=Gc(137820,85016,e+12|0,d);if(a){break c}K[34454]=N[e+12>>2]/68;b=K[34460];K[34456]=b;d:{if(b){i=L[b|0]|L[b+1|0]<<8|(L[b+2|0]<<16|L[b+3|0]<<24);if((i|0)==83969){break d}}e:{f:{if(d){b=K[d>>2];if(b){Ha(K[b+4>>2]);a=K[d>>2];break f}a=Qa(16);K[d>>2]=a;if(a){break f}a=48}else{a=268436223}break e}K[a>>2]=1;K[a+4>>2]=oc(137584);b=K[d>>2];K[b+12>>2]=83969;K[b+8>>2]=i;a=268436223}break c}l=L[b+4|0]|L[b+5|0]<<8|(L[b+6|0]<<16|L[b+7|0]<<24);b=K[34458];n=L[b|0];K[34461]=n;if(n){a=b+4|0;i=0;while(1){c=Q(i,44)+137856|0;d=L[a|0];K[c+36>>2]=d;K[c+40>>2]=L[a+1|0];f=L[a+8|0]|L[a+9|0]<<8|(L[a+10|0]<<16|L[a+11|0]<<24);b=L[a+4|0]|L[a+5|0]<<8|(L[a+6|0]<<16|L[a+7|0]<<24);I[c|0]=b;I[c+1|0]=b>>>8;I[c+2|0]=b>>>16;I[c+3|0]=b>>>24;I[c+4|0]=f;I[c+5|0]=f>>>8;I[c+6|0]=f>>>16;I[c+7|0]=f>>>24;f=L[a+16|0]|L[a+17|0]<<8|(L[a+18|0]<<16|L[a+19|0]<<24);b=L[a+12|0]|L[a+13|0]<<8|(L[a+14|0]<<16|L[a+15|0]<<24);I[c+8|0]=b;I[c+9|0]=b>>>8;I[c+10|0]=b>>>16;I[c+11|0]=b>>>24;I[c+12|0]=f;I[c+13|0]=f>>>8;I[c+14|0]=f>>>16;I[c+15|0]=f>>>24;f=L[a+24|0]|L[a+25|0]<<8|(L[a+26|0]<<16|L[a+27|0]<<24);b=L[a+20|0]|L[a+21|0]<<8|(L[a+22|0]<<16|L[a+23|0]<<24);I[c+16|0]=b;I[c+17|0]=b>>>8;I[c+18|0]=b>>>16;I[c+19|0]=b>>>24;I[c+20|0]=f;I[c+21|0]=f>>>8;I[c+22|0]=f>>>16;I[c+23|0]=f>>>24;f=L[a+32|0]|L[a+33|0]<<8|(L[a+34|0]<<16|L[a+35|0]<<24);b=L[a+28|0]|L[a+29|0]<<8|(L[a+30|0]<<16|L[a+31|0]<<24);I[c+24|0]=b;I[c+25|0]=b>>>8;I[c+26|0]=b>>>16;I[c+27|0]=b>>>24;I[c+28|0]=f;I[c+29|0]=f>>>8;I[c+30|0]=f>>>16;I[c+31|0]=f>>>24;b=a+36|0;K[c+32>>2]=b;a=b+(d<<4)|0;i=i+1|0;if((n|0)!=(i|0)){continue}break}}if((n|0)<=K[34457]){K[34457]=0}a=0;if(!k){break c}K[k>>2]=l}sa=e+16|0;b=a;if(!a){k=K[g+12>>2];K[50754]=k;K[50759]=0;K[50760]=134217728/(k|0);K[50762]=0;K[50763]=0;K[50765]=2147483647;K[50781]=100;K[50779]=32;K[50761]=(k<<6)/(k|0);a=K[26385];K[50784]=K[26384];K[50785]=a;a=K[26387];K[50786]=K[26386];K[50787]=a;a=K[26389];K[50788]=K[26388];K[50789]=a;a=K[26391];K[50790]=K[26390];K[50791]=a;a=K[26393];K[50792]=K[26392];K[50793]=a;a=K[26395];K[50794]=K[26394];K[50795]=a;a=K[26397];K[50796]=K[26396];K[50797]=a;K[50798]=K[26398];d=Q(k,60);a=(d|0)/12800|0;l=(a|0)>=128?128:a;K[50799]=l;K[50800]=(l|0)/2;g:{if((k|0)==22050|(d|0)<12800){break g}a=(l|0)<=1?1:l;k=a&1;q=+(l|0);i=0;if((l|0)>=2){l=a&2147483646;a=0;while(1){o=i+132160|0;h=(1-hb(+(i|0)*6.283185307179586/q))*127;h:{if(S(h)<2147483648){m=~~h;break h}m=-2147483648}I[o|0]=m;d=i|1;o=d+132160|0;h=(1-hb(+(d|0)*6.283185307179586/q))*127;i:{if(S(h)<2147483648){m=~~h;break i}m=-2147483648}I[o|0]=m;i=i+2|0;a=a+2|0;if((l|0)!=(a|0)){continue}break}}if(!k){break g}a=i+132160|0;h=(1-hb(+(i|0)*6.283185307179586/q))*127;j:{if(S(h)<2147483648){o=~~h;break j}o=-2147483648}I[a|0]=o}K[50801]=105792;K[56797]=Ce();K[55964]=38;K[55921]=1;K[55918]=22050;K[56606]=0;K[55960]=110928;K[55958]=0;K[55959]=1074266112;K[55956]=100;K[55922]=20;K[55923]=220;K[55916]=1;K[55917]=0;id();K[56244]=0;K[56245]=0;K[55928]=0;K[55926]=0;K[55927]=0;K[55924]=0;K[56246]=0;K[56247]=0;K[56260]=0;K[56261]=0;K[56262]=0;K[56263]=0;K[56276]=0;K[56277]=0;K[56278]=0;K[56279]=0;K[55974]=0;K[55975]=0;K[55972]=0;K[55973]=0;a=K[55918];q=-3.141592653589793/+(a|0);P[27967]=q;d=(Q(a,630)|0)/1e4|0;K[55920]=d;a=(Q(a,950)|0)/1e4|0;K[55919]=a;h=q*-2;P[27968]=h;w=nb(q*+(d|0));q=w*-w;P[28129]=q;h=w*hb(h*+(a|0));h=h+h;P[28128]=h;P[28127]=1-h-q;K[55990]=0;K[55991]=0;K[55988]=0;K[55989]=0;K[56006]=0;K[56007]=0;K[56004]=0;K[56005]=0;K[56022]=0;K[56023]=0;K[56020]=0;K[56021]=0;K[56038]=0;K[56039]=0;K[56036]=0;K[56037]=0;K[56054]=0;K[56055]=0;K[56052]=0;K[56053]=0;K[56070]=0;K[56071]=0;K[56068]=0;K[56069]=0;K[56086]=0;K[56087]=0;K[56084]=0;K[56085]=0;K[56102]=0;K[56103]=0;K[56100]=0;K[56101]=0;K[56118]=0;K[56119]=0;K[56116]=0;K[56117]=0;K[56134]=0;K[56135]=0;K[56132]=0;K[56133]=0;K[56150]=0;K[56151]=0;K[56148]=0;K[56149]=0;K[56166]=0;K[56167]=0;K[56164]=0;K[56165]=0;K[56182]=0;K[56183]=0;K[56180]=0;K[56181]=0;K[56198]=0;K[56199]=0;K[56196]=0;K[56197]=0;K[56214]=0;K[56215]=0;K[56212]=0;K[56213]=0;K[56230]=0;K[56231]=0;K[56228]=0;K[56229]=0;K[56639]=59;K[56640]=59;K[56629]=0;K[56630]=59;K[56619]=89;K[56620]=160;K[56609]=280;K[56610]=688;K[56611]=1064;K[56621]=70;K[56631]=59;K[56612]=2806;K[56613]=3260;K[56622]=160;K[56623]=200;K[56632]=59;K[56633]=59;K[56641]=89;K[56642]=149;K[56643]=200;K[56644]=200;K[56634]=59;K[56635]=59;K[56624]=200;K[56625]=500;K[56614]=3700;K[56615]=6500;K[56645]=500;K[56646]=0;K[56616]=7e3;K[56626]=500;K[56636]=0;K[56647]=0;K[56637]=0;K[56627]=500;K[56617]=8e3;K[56669]=89;K[56648]=0;K[56638]=0;K[56628]=89;K[56618]=280;K[56657]=62;K[56655]=0;K[56656]=0;K[56653]=50;K[56654]=0;K[56651]=0;K[56652]=0;K[56649]=0;K[56650]=40;K[56607]=1e3;K[56608]=59;e=sa-416|0;sa=e;K[e+16>>2]=137584;K[e+20>>2]=47;K[e+24>>2]=85952;a=e+240|0;Aa(a,85699,e+16|0);f=Cb(a,86034);if(f){if(vc(e+240|0,170,f)){a=e+240|0;k=a|5;l=a|10;while(1){k:{if(L[e+240|0]==47){break k}if(K[e+240>>2]==1701736308){a=sa-48|0;sa=a;K[32960]=-1;K[32961]=-1;K[32970]=-1;K[32971]=-1;K[32968]=-1;K[32969]=-1;K[32966]=-1;K[32967]=-1;K[32964]=-1;K[32965]=-1;K[32962]=-1;K[32963]=-1;K[a+36>>2]=131876;K[a+32>>2]=131872;K[a+28>>2]=131868;K[a+24>>2]=131864;K[a+20>>2]=131860;K[a+16>>2]=131856;K[a+12>>2]=131852;K[a+8>>2]=131848;K[a+4>>2]=131844;K[a>>2]=131840;Ka(k,84222,a);sa=a+48|0;break k}if($a(e+240|0,86614,9)){break k}K[e+4>>2]=e+32;K[e>>2]=e+239;if((Ka(l,86829,e)|0)!=2){break k}d=K[34064];n=(d<<4)+136272|0;K[n>>2]=I[e+239|0];a=oc(e+32|0);K[34064]=d+1;K[n+12>>2]=a;K[n+4>>2]=0}if(vc(e+240|0,170,f)){continue}break}}_a(f)}sa=e+416|0;K[50297]=0;K[50298]=0;K[50301]=0;K[50302]=0;K[50299]=0;K[50300]=0;zd(0,85698);K[36425]=0;K[36424]=0;K[36426]=0;K[36427]=-1;af();Oe(0);c=K[25690];K[34062]=c;j=K[25689];e=K[25688];K[34060]=e;K[34061]=j;p=K[25687];f=K[25686];K[34058]=f;K[34059]=p;r=K[25685];n=K[25684];K[34056]=n;K[34057]=r;t=K[25683];k=K[25682];K[34054]=k;K[34055]=t;u=K[25681];l=K[25680];K[34052]=l;K[34053]=u;m=K[25679];d=K[25678];K[34050]=d;K[34051]=m;o=K[25677];a=K[25676];K[34048]=a;K[34049]=o;K[33729]=a;K[33730]=o;K[33731]=d;K[33732]=m;K[33733]=l;K[33734]=u;K[33735]=k;K[33736]=t;K[33737]=n;K[33738]=r;K[33739]=f;K[33740]=p;K[33741]=e;K[33742]=j;K[33743]=c;_b(1,175);_b(2,100);_b(6,K[47200]);_b(5,K[47201]);_b(7,0);K[47198]=0;K[47197]=0;h=+ca()/1e3;l:{if(S(h)<0x8000000000000000){a=~~h>>>0;break l}a=0}d=vg(a,0,1103515245,0);a=va;d=d+12345|0;a=d>>>0<12345?a+1|0:a;K[33209]=xg(d,a)}sa=g+16|0;if(b){o=K[30450];t=K[s+12>>2];j=sa-560|0;sa=j;g=j+48|0;c=sa-16|0;sa=c;m:{n:{switch(yg(b-268435967|0,24)|0){case 0:La(g,84133,512);break m;case 1:La(g,84580,512);break m;case 2:La(g,84747,512);break m;case 3:La(g,85084,512);break m;case 4:La(g,85251,512);break m;case 5:La(g,85380,512);break m;case 6:La(g,85607,512);break m;case 7:La(g,85722,512);break m;case 8:La(g,85913,512);break m;case 9:La(g,86046,512);break m;case 10:La(g,86153,512);break m;case 11:La(g,86678,512);break m;case 12:La(g,86773,512);break m;case 14:La(g,86958,512);break m;case 15:La(g,87071,512);break m;default:break n}}if(!(b&1879048192)){i=0;e=M[((b>>>0<=153?b:0)<<1)+123728>>1]+121804|0;b=K[K[56841]+20>>2];if(b){u=K[b+4>>2];p=K[b>>2];r=K[p>>2]+1794895138|0;m=Hb(K[p+8>>2],r);d=Hb(K[p+12>>2],r);a=Hb(K[p+16>>2],r);o:{if(u>>>2>>>0<=m>>>0){break o}b=u-(m<<2)|0;if((a|d)&3|(b>>>0<=d>>>0|a>>>0>=b>>>0)){break o}k=a>>>2|0;l=d>>>2|0;while(1){f=m>>>1|0;d=f+x|0;a=d<<1;b=(a+l<<2)+p|0;n=Hb(K[b>>2],r);b=Hb(K[b+4>>2],r);if(b>>>0>=u>>>0|n>>>0>=u-b>>>0|L[(b+n|0)+p|0]){break o}b=Oa(e,b+p|0);if(!b){b=(a+k<<2)+p|0;a=Hb(K[b>>2],r);b=Hb(K[b+4>>2],r);if(b>>>0>=u>>>0|a>>>0>=u-b>>>0){break o}i=L[(a+b|0)+p|0]?0:b+p|0;break o}if((m|0)==1){break o}b=(b|0)<0;m=b?f:m-f|0;x=b?x:d;continue}}}a=i?i:e;b=Ba(a);if(b>>>0>=512){Fa(g,a,511);I[g+511|0]=0;break m}Fa(g,a,b+1|0);break m}K[c>>2]=b;sb(g,512,87182,c)}sa=c+16|0;p:{if(t){q:{switch(K[t>>2]){case 0:K[j+16>>2]=K[t+4>>2];K[j+20>>2]=j+48;Na(o,87384,j+16|0);break p;case 1:break q;default:break p}}a=K[t+12>>2];b=K[t+8>>2];K[j+36>>2]=K[t+4>>2];va=b;K[j+40>>2]=a;K[j+44>>2]=va;K[j+32>>2]=j+48;Na(o,87521,j+32|0);break p}K[j>>2]=j+48;Na(o,87700,j)}sa=j+560|0;r:{if((s|0)==-12){break r}b=K[s+12>>2];if(!b){break r}Ha(K[b+4>>2]);Ha(K[s+12>>2]);K[s+12>>2]=0}}b=K[24806];K[34389]=0;K[32538]=b;b=Q(K[50754],100);b=((b-((b|0)%1e3|0)|0)+1e3|0)/500|0;K[34390]=b;b=yb(K[34391],b);K[34392]=b;s:{if(!b){break s}K[34391]=b;K[34393]=40;b=yb(K[34388],1440);if(!b){break s}K[34388]=b}K[47198]=0;sa=s+16|0;a=K[50754];K[33208]=a}K[v+4>>2]=a;K[v>>2]=Ac();return v|0}function Qa(a){a=a|0;var b=0,c=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;l=sa-16|0;sa=l;a:{b:{c:{d:{e:{f:{g:{h:{i:{if(a>>>0<=244){g=K[57152];h=a>>>0<11?16:a+11&-8;c=h>>>3|0;b=g>>>c|0;if(b&3){c=c+((b^-1)&1)|0;a=c<<3;b=a+228648|0;d=K[a+228656>>2];a=K[d+8>>2];j:{if((b|0)==(a|0)){K[57152]=yg(-2,c)&g;break j}K[a+12>>2]=b;K[b+8>>2]=a}a=d+8|0;b=c<<3;K[d+4>>2]=b|3;b=b+d|0;K[b+4>>2]=K[b+4>>2]|1;break a}k=K[57154];if(k>>>0>=h>>>0){break i}if(b){a=2<<c;a=(0-a|a)&b<<c;d=ug(0-a&a);a=d<<3;b=a+228648|0;e=K[a+228656>>2];a=K[e+8>>2];k:{if((b|0)==(a|0)){g=yg(-2,d)&g;K[57152]=g;break k}K[a+12>>2]=b;K[b+8>>2]=a}K[e+4>>2]=h|3;c=e+h|0;a=d<<3;d=a-h|0;K[c+4>>2]=d|1;K[a+e>>2]=d;if(k){b=(k&-8)+228648|0;f=K[57157];a=1<<(k>>>3);l:{if(!(a&g)){K[57152]=a|g;a=b;break l}a=K[b+8>>2]}K[b+8>>2]=f;K[a+12>>2]=f;K[f+12>>2]=b;K[f+8>>2]=a}a=e+8|0;K[57157]=c;K[57154]=d;break a}j=K[57153];if(!j){break i}c=K[(ug(0-j&j)<<2)+228912>>2];f=(K[c+4>>2]&-8)-h|0;b=c;while(1){m:{a=K[b+16>>2];if(!a){a=K[b+20>>2];if(!a){break m}}b=(K[a+4>>2]&-8)-h|0;d=b>>>0<f>>>0;f=d?b:f;c=d?a:c;b=a;continue}break}i=K[c+24>>2];d=K[c+12>>2];if((d|0)!=(c|0)){a=K[c+8>>2];K[a+12>>2]=d;K[d+8>>2]=a;break b}b=c+20|0;a=K[b>>2];if(!a){a=K[c+16>>2];if(!a){break h}b=c+16|0}while(1){e=b;d=a;b=a+20|0;a=K[b>>2];if(a){continue}b=d+16|0;a=K[d+16>>2];if(a){continue}break}K[e>>2]=0;break b}h=-1;if(a>>>0>4294967231){break i}a=a+11|0;h=a&-8;j=K[57153];if(!j){break i}f=0-h|0;g=0;n:{if(h>>>0<256){break n}g=31;if(h>>>0>16777215){break n}a=T(a>>>8|0);g=((h>>>38-a&1)-(a<<1)|0)+62|0}b=K[(g<<2)+228912>>2];o:{p:{q:{if(!b){a=0;break q}a=0;c=h<<((g|0)!=31?25-(g>>>1|0)|0:0);while(1){r:{e=(K[b+4>>2]&-8)-h|0;if(e>>>0>=f>>>0){break r}d=b;f=e;if(e){break r}f=0;a=b;break p}e=K[b+20>>2];b=K[((c>>>29&4)+b|0)+16>>2];a=e?(e|0)==(b|0)?a:e:a;c=c<<1;if(b){continue}break}}if(!(a|d)){d=0;a=2<<g;a=(0-a|a)&j;if(!a){break i}a=K[(ug(a&0-a)<<2)+228912>>2]}if(!a){break o}}while(1){b=(K[a+4>>2]&-8)-h|0;c=b>>>0<f>>>0;f=c?b:f;d=c?a:d;b=K[a+16>>2];if(b){a=b}else{a=K[a+20>>2]}if(a){continue}break}}if(!d|K[57154]-h>>>0<=f>>>0){break i}g=K[d+24>>2];c=K[d+12>>2];if((d|0)!=(c|0)){a=K[d+8>>2];K[a+12>>2]=c;K[c+8>>2]=a;break c}b=d+20|0;a=K[b>>2];if(!a){a=K[d+16>>2];if(!a){break g}b=d+16|0}while(1){e=b;c=a;b=a+20|0;a=K[b>>2];if(a){continue}b=c+16|0;a=K[c+16>>2];if(a){continue}break}K[e>>2]=0;break c}a=K[57154];if(a>>>0>=h>>>0){d=K[57157];b=a-h|0;s:{if(b>>>0>=16){c=d+h|0;K[c+4>>2]=b|1;K[a+d>>2]=b;K[d+4>>2]=h|3;break s}K[d+4>>2]=a|3;a=a+d|0;K[a+4>>2]=K[a+4>>2]|1;c=0;b=0}K[57154]=b;K[57157]=c;a=d+8|0;break a}i=K[57155];if(i>>>0>h>>>0){b=i-h|0;K[57155]=b;c=K[57158];a=c+h|0;K[57158]=a;K[a+4>>2]=b|1;K[c+4>>2]=h|3;a=c+8|0;break a}a=0;j=h+47|0;if(K[57270]){c=K[57272]}else{K[57273]=-1;K[57274]=-1;K[57271]=4096;K[57272]=4096;K[57270]=l+12&-16^1431655768;K[57275]=0;K[57263]=0;c=4096}e=j+c|0;f=0-c|0;b=e&f;if(b>>>0<=h>>>0){break a}d=K[57262];if(d){c=K[57260];g=c+b|0;if(d>>>0<g>>>0|c>>>0>=g>>>0){break a}}t:{if(!(L[229052]&4)){u:{v:{w:{x:{d=K[57158];if(d){a=229056;while(1){c=K[a>>2];if(c>>>0<=d>>>0&d>>>0<c+K[a+4>>2]>>>0){break x}a=K[a+8>>2];if(a){continue}break}}c=Ub(0);if((c|0)==-1){break u}g=b;d=K[57271];a=d-1|0;if(a&c){g=(b-c|0)+(a+c&0-d)|0}if(g>>>0<=h>>>0){break u}d=K[57262];if(d){a=K[57260];f=a+g|0;if(d>>>0<f>>>0|a>>>0>=f>>>0){break u}}a=Ub(g);if((c|0)!=(a|0)){break w}break t}g=f&e-i;c=Ub(g);if((c|0)==(K[a>>2]+K[a+4>>2]|0)){break v}a=c}if((a|0)==-1){break u}if(h+48>>>0<=g>>>0){c=a;break t}c=K[57272];c=c+(j-g|0)&0-c;if((Ub(c)|0)==-1){break u}g=c+g|0;c=a;break t}if((c|0)!=-1){break t}}K[57263]=K[57263]|4}c=Ub(b);a=Ub(0);if((c|0)==-1|(a|0)==-1|a>>>0<=c>>>0){break d}g=a-c|0;if(g>>>0<=h+40>>>0){break d}}a=K[57260]+g|0;K[57260]=a;if(a>>>0>N[57261]){K[57261]=a}y:{e=K[57158];if(e){a=229056;while(1){d=K[a>>2];b=K[a+4>>2];if((d+b|0)==(c|0)){break y}a=K[a+8>>2];if(a){continue}break}break f}a=K[57156];if(!(a>>>0<=c>>>0?a:0)){K[57156]=c}a=0;K[57265]=g;K[57264]=c;K[57160]=-1;K[57161]=K[57270];K[57267]=0;while(1){d=a<<3;b=d+228648|0;K[d+228656>>2]=b;K[d+228660>>2]=b;a=a+1|0;if((a|0)!=32){continue}break}d=g-40|0;a=c+8&7?-8-c&7:0;b=d-a|0;K[57155]=b;a=a+c|0;K[57158]=a;K[a+4>>2]=b|1;K[(c+d|0)+4>>2]=40;K[57159]=K[57274];break e}if(L[a+12|0]&8|d>>>0>e>>>0|c>>>0<=e>>>0){break f}K[a+4>>2]=b+g;a=e+8&7?-8-e&7:0;c=a+e|0;K[57158]=c;b=K[57155]+g|0;a=b-a|0;K[57155]=a;K[c+4>>2]=a|1;K[(b+e|0)+4>>2]=40;K[57159]=K[57274];break e}d=0;break b}c=0;break c}if(N[57156]>c>>>0){K[57156]=c}b=c+g|0;a=229056;z:{A:{B:{C:{D:{E:{while(1){if((b|0)!=K[a>>2]){a=K[a+8>>2];if(a){continue}break E}break}if(!(L[a+12|0]&8)){break D}}a=229056;while(1){b=K[a>>2];if(b>>>0<=e>>>0){f=b+K[a+4>>2]|0;if(f>>>0>e>>>0){break C}}a=K[a+8>>2];continue}}K[a>>2]=c;K[a+4>>2]=K[a+4>>2]+g;j=(c+8&7?-8-c&7:0)+c|0;K[j+4>>2]=h|3;g=b+(b+8&7?-8-b&7:0)|0;i=h+j|0;a=g-i|0;if((e|0)==(g|0)){K[57158]=i;a=K[57155]+a|0;K[57155]=a;K[i+4>>2]=a|1;break A}if(K[57157]==(g|0)){K[57157]=i;a=K[57154]+a|0;K[57154]=a;K[i+4>>2]=a|1;K[a+i>>2]=a;break A}f=K[g+4>>2];if((f&3)==1){e=f&-8;F:{if(f>>>0<=255){d=K[g+8>>2];b=f>>>3|0;c=K[g+12>>2];if((c|0)==(d|0)){K[57152]=K[57152]&yg(-2,b);break F}K[d+12>>2]=c;K[c+8>>2]=d;break F}h=K[g+24>>2];c=K[g+12>>2];G:{if((g|0)!=(c|0)){b=K[g+8>>2];K[b+12>>2]=c;K[c+8>>2]=b;break G}H:{f=g+20|0;b=K[f>>2];if(b){break H}f=g+16|0;b=K[f>>2];if(b){break H}c=0;break G}while(1){d=f;c=b;f=c+20|0;b=K[f>>2];if(b){continue}f=c+16|0;b=K[c+16>>2];if(b){continue}break}K[d>>2]=0}if(!h){break F}d=K[g+28>>2];b=(d<<2)+228912|0;I:{if(K[b>>2]==(g|0)){K[b>>2]=c;if(c){break I}K[57153]=K[57153]&yg(-2,d);break F}K[h+(K[h+16>>2]==(g|0)?16:20)>>2]=c;if(!c){break F}}K[c+24>>2]=h;b=K[g+16>>2];if(b){K[c+16>>2]=b;K[b+24>>2]=c}b=K[g+20>>2];if(!b){break F}K[c+20>>2]=b;K[b+24>>2]=c}g=e+g|0;f=K[g+4>>2];a=a+e|0}K[g+4>>2]=f&-2;K[i+4>>2]=a|1;K[a+i>>2]=a;if(a>>>0<=255){b=(a&-8)+228648|0;c=K[57152];a=1<<(a>>>3);J:{if(!(c&a)){K[57152]=a|c;a=b;break J}a=K[b+8>>2]}K[b+8>>2]=i;K[a+12>>2]=i;K[i+12>>2]=b;K[i+8>>2]=a;break A}f=31;if(a>>>0<=16777215){b=T(a>>>8|0);f=((a>>>38-b&1)-(b<<1)|0)+62|0}K[i+28>>2]=f;K[i+16>>2]=0;K[i+20>>2]=0;b=(f<<2)+228912|0;d=K[57153];c=1<<f;K:{if(!(d&c)){K[57153]=c|d;K[b>>2]=i;break K}f=a<<((f|0)!=31?25-(f>>>1|0)|0:0);c=K[b>>2];while(1){b=c;if((K[c+4>>2]&-8)==(a|0)){break B}c=f>>>29|0;f=f<<1;d=(c&4)+b|0;c=K[d+16>>2];if(c){continue}break}K[d+16>>2]=i}K[i+24>>2]=b;K[i+12>>2]=i;K[i+8>>2]=i;break A}d=g-40|0;a=c+8&7?-8-c&7:0;b=d-a|0;K[57155]=b;a=a+c|0;K[57158]=a;K[a+4>>2]=b|1;K[(c+d|0)+4>>2]=40;K[57159]=K[57274];a=(f+(f-39&7?39-f&7:0)|0)-47|0;d=a>>>0<e+16>>>0?e:a;K[d+4>>2]=27;a=K[57267];K[d+16>>2]=K[57266];K[d+20>>2]=a;a=K[57265];K[d+8>>2]=K[57264];K[d+12>>2]=a;K[57266]=d+8;K[57265]=g;K[57264]=c;K[57267]=0;a=d+24|0;while(1){K[a+4>>2]=7;b=a+8|0;a=a+4|0;if(b>>>0<f>>>0){continue}break}if((d|0)==(e|0)){break e}K[d+4>>2]=K[d+4>>2]&-2;f=d-e|0;K[e+4>>2]=f|1;K[d>>2]=f;if(f>>>0<=255){b=(f&-8)+228648|0;c=K[57152];a=1<<(f>>>3);L:{if(!(c&a)){K[57152]=a|c;a=b;break L}a=K[b+8>>2]}K[b+8>>2]=e;K[a+12>>2]=e;K[e+12>>2]=b;K[e+8>>2]=a;break e}a=31;if(f>>>0<=16777215){a=T(f>>>8|0);a=((f>>>38-a&1)-(a<<1)|0)+62|0}K[e+28>>2]=a;K[e+16>>2]=0;K[e+20>>2]=0;b=(a<<2)+228912|0;d=K[57153];c=1<<a;M:{if(!(d&c)){K[57153]=c|d;K[b>>2]=e;break M}a=f<<((a|0)!=31?25-(a>>>1|0)|0:0);d=K[b>>2];while(1){b=d;if((f|0)==(K[b+4>>2]&-8)){break z}c=a>>>29|0;a=a<<1;c=(c&4)+b|0;d=K[c+16>>2];if(d){continue}break}K[c+16>>2]=e}K[e+24>>2]=b;K[e+12>>2]=e;K[e+8>>2]=e;break e}a=K[b+8>>2];K[a+12>>2]=i;K[b+8>>2]=i;K[i+24>>2]=0;K[i+12>>2]=b;K[i+8>>2]=a}a=j+8|0;break a}a=K[b+8>>2];K[a+12>>2]=e;K[b+8>>2]=e;K[e+24>>2]=0;K[e+12>>2]=b;K[e+8>>2]=a}a=K[57155];if(a>>>0<=h>>>0){break d}b=a-h|0;K[57155]=b;c=K[57158];a=c+h|0;K[57158]=a;K[a+4>>2]=b|1;K[c+4>>2]=h|3;a=c+8|0;break a}K[56798]=48;a=0;break a}N:{if(!g){break N}b=K[d+28>>2];a=(b<<2)+228912|0;O:{if(K[a>>2]==(d|0)){K[a>>2]=c;if(c){break O}j=yg(-2,b)&j;K[57153]=j;break N}K[g+(K[g+16>>2]==(d|0)?16:20)>>2]=c;if(!c){break N}}K[c+24>>2]=g;a=K[d+16>>2];if(a){K[c+16>>2]=a;K[a+24>>2]=c}a=K[d+20>>2];if(!a){break N}K[c+20>>2]=a;K[a+24>>2]=c}P:{if(f>>>0<=15){a=f+h|0;K[d+4>>2]=a|3;a=a+d|0;K[a+4>>2]=K[a+4>>2]|1;break P}K[d+4>>2]=h|3;e=d+h|0;K[e+4>>2]=f|1;K[e+f>>2]=f;if(f>>>0<=255){b=(f&-8)+228648|0;c=K[57152];a=1<<(f>>>3);Q:{if(!(c&a)){K[57152]=a|c;a=b;break Q}a=K[b+8>>2]}K[b+8>>2]=e;K[a+12>>2]=e;K[e+12>>2]=b;K[e+8>>2]=a;break P}a=31;if(f>>>0<=16777215){a=T(f>>>8|0);a=((f>>>38-a&1)-(a<<1)|0)+62|0}K[e+28>>2]=a;K[e+16>>2]=0;K[e+20>>2]=0;b=(a<<2)+228912|0;R:{c=1<<a;S:{if(!(c&j)){K[57153]=c|j;K[b>>2]=e;break S}a=f<<((a|0)!=31?25-(a>>>1|0)|0:0);h=K[b>>2];while(1){b=h;if((K[b+4>>2]&-8)==(f|0)){break R}c=a>>>29|0;a=a<<1;c=(c&4)+b|0;h=K[c+16>>2];if(h){continue}break}K[c+16>>2]=e}K[e+24>>2]=b;K[e+12>>2]=e;K[e+8>>2]=e;break P}a=K[b+8>>2];K[a+12>>2]=e;K[b+8>>2]=e;K[e+24>>2]=0;K[e+12>>2]=b;K[e+8>>2]=a}a=d+8|0;break a}T:{if(!i){break T}b=K[c+28>>2];a=(b<<2)+228912|0;U:{if(K[a>>2]==(c|0)){K[a>>2]=d;if(d){break U}K[57153]=yg(-2,b)&j;break T}K[i+(K[i+16>>2]==(c|0)?16:20)>>2]=d;if(!d){break T}}K[d+24>>2]=i;a=K[c+16>>2];if(a){K[d+16>>2]=a;K[a+24>>2]=d}a=K[c+20>>2];if(!a){break T}K[d+20>>2]=a;K[a+24>>2]=d}V:{if(f>>>0<=15){a=f+h|0;K[c+4>>2]=a|3;a=a+c|0;K[a+4>>2]=K[a+4>>2]|1;break V}K[c+4>>2]=h|3;d=c+h|0;K[d+4>>2]=f|1;K[d+f>>2]=f;if(k){b=(k&-8)+228648|0;e=K[57157];a=1<<(k>>>3);W:{if(!(a&g)){K[57152]=a|g;a=b;break W}a=K[b+8>>2]}K[b+8>>2]=e;K[a+12>>2]=e;K[e+12>>2]=b;K[e+8>>2]=a}K[57157]=d;K[57154]=f}a=c+8|0}sa=l+16|0;return a|0}function kb(a,b,c,d,e){var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0;h=sa-544|0;sa=h;Ea(h+320|0,0,100);Ea(h+208|0,0,100);j=c?K[c>>2]:j;o=K[a+12>>2];k=K[36115];a:{b:{c:{d:{while(1){f=L[b+g|0];f=(f|0)>=(k|0)?13:f;I[h+g|0]=f;if(!f){f=g;break d}f=g|1;i=L[f+b|0];i=(k|0)<=(i|0)?13:i;I[f+h|0]=i;if(!i){break d}g=g+2|0;if((g|0)!=200){continue}break}g=198;q=L[h+199|0];break c}if(!f){break b}g=f-1|0;q=L[h+g|0];if((f|0)==1){break c}g=f-2|0}u=j&8;K[h+536>>2]=(u>>>3|0?3:7)&j;j=L[h+g|0];k=1;l=Md(a,h,h+432|0,h+540|0,h+536|0,1);m=(l|0)>=0?l:0;s=L[h|0];if(s){g=h;f=s;while(1){f=K[((f&255)<<2)+144464>>2];e:{if(L[f+11|0]!=2){break e}f=K[f+4>>2];if(f&1048576){break e}i=(f&2097152)>>>21|0;n=g+1|0;f=L[K[(L[n|0]<<2)+144464>>2]+10|0]==12;i=i|f;I[(h+208|0)+k|0]=i;p=K[(L[(f?2:1)+g|0]<<2)+144464>>2];i=L[p+11|0]-10>>>0<4294967289|!(L[p+6|0]&32)&L[K[(L[(f?3:2)+g|0]<<2)+144464>>2]+11|0]==2?i:i?2:1;g=f?n:g;I[(h+320|0)+k|0]=i;k=k+1|0}g=g+1|0;f=L[g|0];if(f){continue}break}}c=c?m:l;g=c;f:{g:{h:{i:{j:{k:{l:{m:{n:{o:{p:{q:{switch(K[a+8>>2]-1|0){case 11:c=K[h+540>>2];if((c|0)<2){break n}g=1;f=c-1|0;m=f&1;if((c|0)!=2){break p}k=0;break o;case 8:f=K[h+540>>2];if((f|0)<2){break g}i=f-1|0;k=i&3;g=1;if(f-2>>>0>=3){m=i&-4;i=0;while(1){f=(h+432|0)+g|0;j=I[f|0];I[f|0]=(j|0)<0?4:j;j=I[f+1|0];I[f+1|0]=(j|0)<0?4:j;j=I[f+2|0];I[f+2|0]=(j|0)<0?4:j;j=f;f=I[f+3|0];I[j+3|0]=(f|0)<0?4:f;g=g+4|0;i=i+4|0;if((m|0)!=(i|0)){continue}break}}if(!k){break g}f=0;while(1){j=(h+432|0)+g|0;i=I[j|0];I[j|0]=(i|0)<0?4:i;g=g+1|0;f=f+1|0;if((k|0)!=(f|0)){continue}break};break g;case 7:if(!L[h+322|0]|I[h+321|0]>0){break g}case 0:if(K[h+536>>2]|K[h+540>>2]<3){break g}K[h+536>>2]=2;g=4;if(c){break f}I[h+434|0]=4;break f;case 1:if(K[h+536>>2]){break f}k=K[h+540>>2];r:{s:{if((k|0)>=3){c=k-2|0;K[h+536>>2]=c;g=c;t:{if(!(o&512)){break t}f=K[(q<<2)+144464>>2];i=L[f+11|0];if((i|0)==2){break t}g=K[f>>2];f=h;u:{v:{m=K[a+212>>2];if((m|0)!=26977){if((m|0)!=24942){break v}w:{switch(g-110|0){case 0:case 5:g=c;if(L[K[(j<<2)+144464>>2]+11|0]==2){break t}break;default:break w}}g=k-1|0;break u}if((g|0)==115){g=c;if(L[K[(j<<2)+144464>>2]+11|0]==2){break t}}g=k-1|0;break u}x:{y:{if((g|0)==115){g=c;i=L[K[(j<<2)+144464>>2]+11|0];if((i|0)!=8){break y}break t}if((i|0)!=8){break x}i=L[K[(j<<2)+144464>>2]+11|0]}g=c;if((i&255)==2){break t}}g=k-1|0}K[f+536>>2]=g}z:{if(!(o&524288)){break z}f=k-1|0;k=h+208|0;if(I[f+k|0]<=I[c+k|0]){break z}K[h+536>>2]=f;g=f}if(L[(h+432|0)+g|0]>1){f=g;break r}f=2;c=g-1|0;if(g>>>0>=2){break s}K[h+536>>2]=g+1;break r}c=1}f=c;K[h+536>>2]=f}g=4;c=(h+432|0)+f|0;if(I[c|0]>=0){break f}f=(h+432|0)+f|0;if(I[f-1|0]>=4&I[f+1|0]>3){break f}I[c|0]=4;break f;case 2:if(K[h+536>>2]){break f}g=K[h+540>>2];c=g-1|0;c=c>>31&c;while(1){g=g-1|0;if((g|0)<=0){break h}f=(h+432|0)+g|0;if(I[f|0]>=0){continue}break};K[h+536>>2]=g;g=4;I[f|0]=4;break f;case 3:if(K[h+536>>2]){break g}g=K[h+540>>2]-3|0;f=(g|0)<=1?1:g;K[h+536>>2]=f;g=4;if(c){break f}I[f+(h+432|0)|0]=4;break f;case 4:if(K[h+536>>2]){break f}c=K[h+540>>2];f=c-3|0;K[h+536>>2]=f;if((c|0)<=15){A:{B:{switch(L[K[(q<<2)+144464>>2]+11|0]-2|0){case 0:f=I[c+94176|0];break A;case 2:f=I[c+94192|0];break A;default:break B}}f=I[c+94160|0]}K[h+536>>2]=f}g=4;I[(h+432|0)+f|0]=4;break f;case 5:if(K[h+536>>2]){break f}k=-1;i=0;f=K[h+540>>2];c=f-1|0;C:{if((c|0)<2){break C}g=1;n=f&1;if((f|0)!=3){p=(f&-2)-4|0;f=0;while(1){if(I[(h+432|0)+g|0]<0){m=I[(h+320|0)+g|0];j=(m|0)<(k|0);i=j?i:g;k=j?k:m}j=g+1|0;if(I[j+(h+432|0)|0]<0){t=I[j+(h+320|0)|0];m=(t|0)<(k|0);i=m?i:j;k=m?k:t}g=g+2|0;j=(f|0)!=(p|0);f=f+2|0;if(j){continue}break}}if(!n|I[(h+432|0)+g|0]>=0){break C}j=I[(h+320|0)+g|0];f=(j|0)<(k|0);k=f?k:j;i=f?i:g}K[h+536>>2]=i;D:{if(!(L[c+(h+320|0)|0]!=2|(k|0)>1)){K[h+536>>2]=c;i=c;break D}if((k|0)>0){break D}i=1;K[h+536>>2]=1}g=4;I[(h+432|0)+i|0]=4;break f;case 14:break i;case 12:break j;case 6:break q;default:break f}}if(K[h+536>>2]){break f}c=K[h+540>>2];k=c-1|0;K[h+536>>2]=k;E:{if((c|0)<2){break E}g=1;while(1){if(L[(h+432|0)+g|0]==1){k=g-1|0;K[h+536>>2]=k;break E}g=g+1|0;if((c|0)!=(g|0)){continue}break}}g=4;I[(h+432|0)+k|0]=4;break f}n=f&-2;k=0;i=0;while(1){j=h+432|0;p=j+g|0;f=L[p|0];r=p;p=h+208|0;t=I[p+g|0]>0;I[r|0]=t?3:(f|0)==4?3:f;f=g+1|0;r=f+j|0;j=L[r|0];v=(j|0)==4?3:j;j=I[f+p|0]>0;I[r|0]=j?3:v;k=j?f:t?g:k;g=g+2|0;i=i+2|0;if((n|0)!=(i|0)){continue}break}}if(m){i=(h+432|0)+g|0;f=L[i|0];j=(f|0)==4?3:f;f=I[(h+208|0)+g|0]>0;I[i|0]=f?3:j;k=f?g:k}f=K[h+536>>2];if(f){break k}if((k|0)>0){K[h+536>>2]=k;f=k;break k}if((c|0)<6){break m}f=c-3|0;break l}f=K[h+536>>2];if(f){break k}}f=c-1|0}K[h+536>>2]=f}g=4;I[(h+432|0)+f|0]=4;break f}if(K[h+536>>2]){break f}f=1;K[h+536>>2]=1;if(!(L[h+209|0]|K[h+540>>2]<3|I[h+210|0]<=0)){f=2;K[h+536>>2]=2}g=4;I[h+432|f]=4;break f}if(K[h+536>>2]){break g}f=K[h+540>>2];if((f|0)<3){break g}Ea(h+432|1,0,f-1|0);K[h+536>>2]=2;if(!c){I[h+434|0]=4}g=4;if(f>>>0<4){break f}I[(f+h|0)+431|0]=3;break f}K[h+536>>2]=c;g=4;break f}g=c}F:{if(!(o&256)|e&2){break F}c=K[h+540>>2];if((c|0)<3|(l|0)>2){break F}c=c+(h+432|0)|0;f=c-1|0;if(L[f|0]!=4|L[K[(q<<2)+144464>>2]+11|0]!=2){break F}I[f|0]=1;I[c-2|0]=4}G:{H:{I:{if(u){l=K[h+540>>2];break I}c=I[h+433|0];J:{l=K[h+540>>2];if(!(o&4096)|(l|0)!=3){break J}if((c|0)==4){I[h+434|0]=3;break H}if(L[h+434|0]!=4){break J}I[h+433|0]=3;break H}if(!(o&8192)|(c|0)>=0|((l|0)<4|I[h+434|0]<4)){break I}I[h+433|0]=3;break H}i=0;if((l|0)<2){break G}}k=(g|0)<4?4:3;p=o&128;t=o&64;r=o&32;m=l-1|0;v=o&16;w=!(o&32768);q=0;j=0;g=1;while(1){n=(h+432|0)+g|0;f=I[n|0];K:{L:{if((f|0)>=0){i=k;break L}i=3;M:{N:{if(!(!v|(k|0)>3)&(g|0)==(m|0)){break N}if(!((q|w)&1)){break M}if(I[(h+g|0)+431|0]>1){i=k;break N}O:{c=g+1|0;f=I[c+(h+432|0)|0];if((f|0)>=2){if((k|0)!=4){break N}i=4;if(f>>>0>=3){break N}break O}if(!r|(k|0)!=3){break O}k=3;break K}if(!t|g>>>0<2){break M}i=L[(h+320|0)+g|0];if(i){break M}f=g;if((m|0)>(f|0)){while(1){if(I[(h+320|0)+f|0]>0){break K}f=f+1|0;if((m|0)!=(f|0)){continue}break}if(i){break M}}if(I[c+(h+320|0)|0]<=0){break M}break K}f=L[n|0];break L}I[n|0]=k;q=1;i=3;f=k}P:{if(f<<24>>24>=4){c=j?j:g;if(!j|!p){break P}I[n|0]=3}k=i;break K}k=i;j=c}i=1;g=g+1|0;if((l|0)!=(g|0)){continue}break}}d=!u|(d|0)>=0?d:K[((l|0)<3?16:20)+a>>2];k=0;f=0;Q:{if(!i){break Q}c=l-1|0;q=c&3;i=0;R:{if(l-2>>>0<3){g=1;break R}u=c&-4;g=1;j=0;while(1){c=h+432|0;m=I[c+g|0];l=(m|0)<(f|0);f=l?f:m;p=g+1|0;n=I[p+c|0];m=(f|0)>(n|0);f=m?f:n;t=g+2|0;r=I[t+c|0];n=(f|0)>(r|0);f=n?f:r;r=g+3|0;v=I[r+c|0];c=(f|0)>(v|0);f=c?f:v;k=c?n?m?l?k:g:p:t:r;g=g+4|0;j=j+4|0;if((u|0)!=(j|0)){continue}break}}if(!q){break Q}while(1){j=I[(h+432|0)+g|0];c=(j|0)<(f|0);f=c?f:j;k=c?k:g;g=g+1|0;i=i+1|0;if((q|0)!=(i|0)){continue}break}}S:{if((d|0)<0){d=f;break S}if((d|0)<=(f|0)&(f|0)>4){break S}I[(h+432|0)+k|0]=d}q=b+197|0;l=1;T:{if(e&1){break T}c=K[(s<<2)+144464>>2];if(!c){break T}f=h;i=L[c+11|0];if(!((i|0)!=1&(s|0)!=15)){while(1){f=f+1|0;c=L[f|0];i=L[K[(c<<2)+144464>>2]+11|0];if((i|0)==1|(c|0)==15){continue}break}}c=K[a+4>>2];if(!(c&48)|(i|0)!=2){break T}I[b|0]=(c&32)>>>5|0?I[h+433|0]>3?11:23:23;b=b+1|0}U:{if(b>>>0>=q>>>0){break U}m=o&65536;n=o&2;u=o&4;g=h;while(1){f=L[g|0];if(!f){break U}e=g;g=g+1|0;c=K[(f<<2)+144464>>2];if(!c){continue}V:{W:{X:{switch(L[c+11|0]){case 0:K[a+8200>>2]=0;break V;case 2:if(!(L[c+6|0]&16)){break W}break;default:break X}}if(L[g|0]!=20){break V}}s=K[h+540>>2];if((s|0)<(l|0)){break a}o=(h+432|0)+l|0;j=I[o|0];K[a+8200>>2]=j;Y:{Z:{_:{c=j;if((c|0)>1){break _}i=s-1|0;if(!(!u|((l|0)<2|(d|0)<2))){c=0;if((i|0)==(l|0)){break Z}}c=1;if((l|0)==1|n|((s-2|0)==(l|0)&I[i+(h+432|0)|0]<2|(i|0)==(l|0))){break _}if(I[(h+l|0)+431|0]>=0){c=j;if(m){break _}}c=0;I[o|0]=0;break Z}if(!c){break Z}if((c|0)<2){break Y}}I[b|0]=L[c+94151|0];b=b+1|0;j=I[o|0]}i=(d|0)>(j|0);$:{if(L[g|0]!=12){break $}s=K[a+28>>2];if(!(s&1)){break $}g=(s&16?(k|0)!=(l|0):(c|0)<4)?e+2|0:g}d=i?d:j;l=l+1|0}if((f|0)!=1){I[b|0]=f;b=b+1|0}if(b>>>0<q>>>0){continue}break}}I[b|0]=0}sa=h+544|0;return}da(86136,86634,1353,94208);D()}function Ud(a,b,c,d,e,f,g,h,i){var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,L=0,M=0,O=0,P=0;k=sa-336|0;sa=k;n=h;p=i&65535;o=d;m=e&65535;u=(e^i)&-2147483648;s=i>>>16&32767;q=e>>>16&32767;a:{b:{if(s-32767>>>0>4294934529&q-32767>>>0>=4294934530){break b}j=e&2147483647;if(!(!d&(j|0)==2147418112?!(b|c):j>>>0<2147418112)){r=d;u=e|32768;break a}e=i&2147483647;if(!(!h&(e|0)==2147418112?!(f|g):e>>>0<2147418112)){r=h;u=i|32768;b=f;c=g;break a}if(!(b|d|(j^2147418112|c))){if(!(f|h|(e^2147418112|g))){b=0;c=0;u=2147450880;break a}u=u|2147418112;b=0;c=0;break a}if(!(f|h|(e^2147418112|g))){b=0;c=0;break a}if(!(b|d|(c|j))){b=!(f|h|(e|g));r=b?0:r;u=b?2147450880:u;b=0;c=0;break a}if(!(f|h|(e|g))){u=u|2147418112;b=0;c=0;break a}if((j|0)==65535|j>>>0<65535){d=!(m|o);i=d;j=d?b:o;d=d<<6;h=d;i=T(i?c:m);d=d+((i|0)==32?T(j)+32|0:i)|0;Xa(k+320|0,b,c,o,m,d-15|0);v=16-d|0;o=K[k+328>>2];m=K[k+332>>2];c=K[k+324>>2];b=K[k+320>>2]}if(e>>>0>65535){break b}d=!(n|p);h=d;i=d?f:n;d=d<<6;e=d;h=T(h?g:p);d=d+((h|0)==32?T(i)+32|0:h)|0;Xa(k+304|0,f,g,n,p,d-15|0);v=(d+v|0)-16|0;n=K[k+312>>2];p=K[k+316>>2];f=K[k+304>>2];g=K[k+308>>2]}e=p|65536;A=e;B=n;d=n;j=e<<15|d>>>17;e=d<<15|g>>>17;d=e;i=0-d|0;h=j;j=1963258675-(j+((d|0)!=0)|0)|0;Ua(k+288|0,d,h,0,0,i,j,0,0);d=K[k+296>>2];Ua(k+272|0,0-d|0,0-(K[k+300>>2]+((d|0)!=0)|0)|0,0,0,i,j,0,0);d=K[k+280>>2];i=d<<1|K[k+276>>2]>>>31;d=K[k+284>>2]<<1|d>>>31;Ua(k+256|0,i,d,0,0,e,h,0,0);j=K[k+264>>2];Ua(k+240|0,i,d,0,0,0-j|0,0-(K[k+268>>2]+((j|0)!=0)|0)|0,0,0);i=K[k+248>>2];j=i<<1|K[k+244>>2]>>>31;d=K[k+252>>2]<<1|i>>>31;Ua(k+224|0,j,d,0,0,e,h,0,0);i=K[k+232>>2];Ua(k+208|0,j,d,0,0,0-i|0,0-(K[k+236>>2]+((i|0)!=0)|0)|0,0,0);d=K[k+216>>2];i=d<<1|K[k+212>>2]>>>31;d=K[k+220>>2]<<1|d>>>31;Ua(k+192|0,i,d,0,0,e,h,0,0);j=K[k+200>>2];Ua(k+176|0,i,d,0,0,0-j|0,0-(K[k+204>>2]+((j|0)!=0)|0)|0,0,0);i=e;e=K[k+184>>2];d=h;n=e<<1|K[k+180>>2]>>>31;h=n-1|0;e=(K[k+188>>2]<<1|e>>>31)-!n|0;Ua(k+160|0,i,d,0,0,h,e,0,0);d=h;Ua(k+144|0,f<<15,g<<15|f>>>17,0,0,d,e,0,0);t=k+112|0;y=K[k+168>>2];h=K[k+172>>2];n=K[k+160>>2];i=K[k+152>>2];l=n+i|0;p=K[k+164>>2];j=p+K[k+156>>2]|0;j=i>>>0>l>>>0?j+1|0:j;i=j;j=(p|0)==(j|0)&l>>>0<n>>>0|j>>>0<p>>>0;p=j+y|0;j=j>>>0>p>>>0?h+1|0:h;n=!i&l>>>0>1|(i|0)!=0;h=n+p|0;j=n>>>0>h>>>0?j+1|0:j;Ua(t,d,e,0,0,0-h|0,0-(((h|0)!=0)+j|0)|0,0,0);Ua(k+128|0,1-l|0,0-((l>>>0>1)+i|0)|0,0,0,d,e,0,0);H=(q-s|0)+v|0;e=K[k+116>>2];t=e;d=K[k+112>>2];j=e<<1|d>>>31;n=d<<1;q=j;d=j;h=K[k+140>>2];z=h;e=K[k+136>>2];j=h<<1|e>>>31;i=e<<1|K[k+132>>2]>>>31;h=i+n|0;d=d+j|0;d=h>>>0<i>>>0?d+1|0:d;e=d;d=d-(h>>>0<13927)|0;x=d;y=d;l=0;j=m|65536;I=j;J=o;d=o;j=j<<1|d>>>31;M=d<<1;O=j;D=j;d=vg(x,l,j,0);j=va;E=d;w=j;v=b<<1;d=c<<1|b>>>31;s=d;j=0;p=j;i=h-13927|0;x=(e|0)==(x|0)&i>>>0<h>>>0|e>>>0>x>>>0;e=(e|0)==(q|0)&h>>>0<n>>>0|e>>>0<q>>>0;d=K[k+120>>2];h=K[k+124>>2]<<1|d>>>31;d=d<<1|t>>>31;j=h;l=z>>>31|0;d=l+d|0;j=d>>>0<l>>>0?j+1|0:j;h=d;d=d+e|0;l=h>>>0>d>>>0?j+1|0:j;e=d;d=d+x|0;l=e>>>0>d>>>0?l+1|0:l;e=d-1|0;x=l-!d|0;q=0;j=vg(s,p,x,q);d=j+E|0;h=va+w|0;h=d>>>0<j>>>0?h+1|0:h;t=(w|0)==(h|0)&d>>>0<E>>>0|h>>>0<w>>>0;j=0;z=e;L=c>>>31|0;C=L|o<<1;w=0;e=vg(e,j,C,w);o=e+d|0;j=va+h|0;l=0;j=e>>>0>o>>>0?j+1|0:j;n=j;d=(j|0)==(h|0)&d>>>0>o>>>0|h>>>0>j>>>0;e=d;d=d+t|0;l=e>>>0>d>>>0?1:l;e=vg(D,p,x,q);d=e+d|0;j=va+l|0;t=d;d=d>>>0<e>>>0?j+1|0:j;e=vg(D,p,z,w);m=va;h=e;e=vg(C,w,x,q);l=h+e|0;j=va+m|0;j=e>>>0>l>>>0?j+1|0:j;e=j;j=(m|0)==(j|0)&h>>>0>l>>>0|j>>>0<m>>>0;m=t+e|0;d=d+j|0;d=m>>>0<e>>>0?d+1|0:d;t=m;m=d;e=0;d=e+o|0;j=l+n|0;j=d>>>0<e>>>0?j+1|0:j;e=j;h=(j|0)==(n|0)&d>>>0<o>>>0|j>>>0<n>>>0;j=m;l=h;h=h+t|0;j=l>>>0>h>>>0?j+1|0:j;F=h;l=j;t=d;m=d;o=e;E=i;d=vg(i,0,C,w);h=va;e=d;i=vg(y,r,s,r);d=d+i|0;j=va+h|0;j=d>>>0<i>>>0?j+1|0:j;i=(h|0)==(j|0)&d>>>0<e>>>0|h>>>0>j>>>0;h=j;G=v&-2;e=vg(z,w,G,0);n=e+d|0;j=va+j|0;j=e>>>0>n>>>0?j+1|0:j;e=j;d=(j|0)==(h|0)&d>>>0>n>>>0|h>>>0>j>>>0;h=0;i=d+i|0;d=(i>>>0<d>>>0?1:h)+o|0;j=l;m=i+m|0;d=m>>>0<i>>>0?d+1|0:d;i=d;d=(d|0)==(o|0)&m>>>0<t>>>0|d>>>0<o>>>0;h=d;d=d+F|0;j=h>>>0>d>>>0?j+1|0:j;P=d;t=j;d=vg(D,p,E,r);F=va;D=d;h=vg(x,q,G,r);d=d+h|0;j=va+F|0;o=d;p=vg(y,r,C,w);l=d+p|0;h=d>>>0<h>>>0?j+1|0:j;d=h+va|0;d=l>>>0<p>>>0?d+1|0:d;q=l;j=vg(s,r,z,w);p=l+j|0;l=va+d|0;l=j>>>0>p>>>0?l+1|0:l;z=0;C=(d|0)==(l|0)&p>>>0<q>>>0|d>>>0>l>>>0;j=(h|0)==(F|0)&o>>>0<D>>>0|h>>>0<F>>>0;d=(d|0)==(h|0)&o>>>0>q>>>0|d>>>0<h>>>0;d=d+j|0;d=d+C|0;h=l;q=h+m|0;j=(d|z)+i|0;j=h>>>0>q>>>0?j+1|0:j;o=j;d=(i|0)==(j|0)&m>>>0>q>>>0|i>>>0>j>>>0;j=t;h=d;d=d+P|0;j=h>>>0>d>>>0?j+1|0:j;z=d;i=j;d=vg(y,r,G,r);y=va;m=d;h=vg(s,r,E,r);d=d+h|0;j=va+y|0;j=d>>>0<h>>>0?j+1|0:j;t=0;h=(j|0)==(y|0)&d>>>0<m>>>0|j>>>0<y>>>0;m=j;d=j+n|0;j=(h|t)+e|0;j=d>>>0<m>>>0?j+1|0:j;h=j;m=(e|0)==(j|0)&d>>>0<n>>>0|e>>>0>j>>>0;j=p;p=0;n=p+d|0;l=h+j|0;j=0;l=n>>>0<p>>>0?l+1|0:l;d=(h|0)==(l|0)&d>>>0>n>>>0|h>>>0>l>>>0;e=d;d=d+m|0;j=(e>>>0>d>>>0?1:j)+o|0;l=i;e=d;d=d+q|0;j=e>>>0>d>>>0?j+1|0:j;e=j;h=(o|0)==(j|0)&d>>>0<q>>>0|j>>>0<o>>>0;i=h;h=h+z|0;l=i>>>0>h>>>0?l+1|0:l;i=l;c:{if((l|0)==131071|l>>>0<131071){J=M|L;I=w|O;Ua(k+80|0,d,e,h,i,f,g,B,A);l=K[k+84>>2];p=l;j=b<<17;n=0;m=K[k+88>>2];c=n-m|0;b=K[k+80>>2];l=(l|b)!=0;o=c-l|0;m=(j-(K[k+92>>2]+(m>>>0>n>>>0)|0)|0)-(c>>>0<l>>>0)|0;n=0-b|0;p=0-(((b|0)!=0)+p|0)|0;b=H+16382|0;break c}d=(e&1)<<31|d>>>1;e=h<<31|e>>>1;h=(i&1)<<31|h>>>1;i=i>>>1|0;Ua(k+96|0,d,e,h,i,f,g,B,A);o=K[k+100>>2];s=o;v=K[k+104>>2];n=0-v|0;l=K[k+96>>2];m=(o|l)!=0;o=n-m|0;m=((b<<16)-(K[k+108>>2]+(p>>>0<v>>>0)|0)|0)-(m>>>0>n>>>0)|0;n=0-l|0;p=0-(((l|0)!=0)+s|0)|0;v=b;s=c;b=H+16383|0}if((b|0)>=32767){u=u|2147418112;b=0;c=0;break a}d:{if((b|0)>0){l=m<<1|o>>>31;o=o<<1|p>>>31;m=l;v=h;s=i&65535|b<<16;l=p<<1|n>>>31;i=n<<1;break d}if((b|0)<=-113){b=0;c=0;break a}Fb(k- -64|0,d,e,h,i,1-b|0);Xa(k+48|0,v,s,J,I,b+112|0);d=K[k+64>>2];e=K[k+68>>2];v=K[k+72>>2];s=K[k+76>>2];Ua(k+32|0,f,g,B,A,d,e,v,s);b=K[k+40>>2];c=K[k+56>>2];l=K[k+36>>2];o=b<<1|l>>>31;n=c-o|0;m=K[k+60>>2]-((K[k+44>>2]<<1|b>>>31)+(c>>>0<o>>>0)|0)|0;b=K[k+32>>2];h=l<<1|b>>>31;j=b<<1;i=K[k+52>>2];c=K[k+48>>2];b=(h|0)==(i|0)&j>>>0>c>>>0|h>>>0>i>>>0;o=n-b|0;m=m-(b>>>0>n>>>0)|0;l=i-((c>>>0<j>>>0)+h|0)|0;i=c-j|0}b=i;Ua(k+16|0,f,g,B,A,3,0,0,0);Ua(k,f,g,B,A,5,0,0,0);c=0;h=l+c|0;j=d&1;b=b+j|0;h=i>>>0>b>>>0?h+1|0:h;i=b;g=(g|0)==(h|0)&b>>>0>f>>>0|g>>>0<h>>>0;l=m;b=(c|0)==(h|0)&b>>>0<j>>>0|c>>>0>h>>>0;f=b+o|0;l=b>>>0>f>>>0?l+1|0:l;j=e;b=(l|0)==(A|0);b=b&(f|0)==(B|0)?g:b&f>>>0>B>>>0|l>>>0>A>>>0;c=b;b=b+d|0;j=c>>>0>b>>>0?j+1|0:j;c=j;d=(e|0)==(j|0)&b>>>0<d>>>0|e>>>0>j>>>0;j=s;e=d;d=d+v|0;j=e>>>0>d>>>0?j+1|0:j;g=d;e=K[k+20>>2];m=(e|0)==(h|0)&N[k+16>>2]<i>>>0|e>>>0<h>>>0;e=K[k+28>>2];d=K[k+24>>2];e=j>>>0<2147418112&((d|0)==(f|0)&(e|0)==(l|0)?m:(e|0)==(l|0)&d>>>0<f>>>0|e>>>0<l>>>0);d=c;m=e;e=b+e|0;d=m>>>0>e>>>0?d+1|0:d;b=(c|0)==(d|0)&b>>>0>e>>>0|c>>>0>d>>>0;c=b;b=b+g|0;j=c>>>0>b>>>0?j+1|0:j;g=b;c=K[k+4>>2];h=(c|0)==(h|0)&N[k>>2]<i>>>0|c>>>0<h>>>0;c=K[k+12>>2];b=K[k+8>>2];b=j>>>0<2147418112&((b|0)==(f|0)&(c|0)==(l|0)?h:(c|0)==(l|0)&b>>>0<f>>>0|c>>>0<l>>>0);c=b;b=b+e|0;l=c>>>0>b>>>0?d+1|0:d;c=l;e=(d|0)==(l|0)&b>>>0<e>>>0|d>>>0>l>>>0;d=j;f=e;e=e+g|0;d=f>>>0>e>>>0?d+1|0:d;r=e|r;u=d|u}K[a>>2]=b;K[a+4>>2]=c;K[a+8>>2]=r;K[a+12>>2]=u;sa=k+336|0}function bb(a,b,c,d,e){var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0;k=sa-80|0;sa=k;p=K[c+8>>2];if(!(!e|!M[c+4>>1])){K[e+8>>2]=0}i=Ea(d,0,152);K[i+44>>2]=L[p+14|0];K[i+40>>2]=L[p+15|0];d=M[p+8>>1];if(d){d=K[34459]+(d<<1)|0;r=b&256;s=c+32|0;v=c-32|0;w=c- -64|0;x=c+96|0;y=c+-64|0;z=c-28|0;A=b&1;B=c-24|0;t=K[30450];while(1){b=M[d>>1];l=b>>>8|0;f=l&15;a:{b:{c:{d:{e:{f:{g:{h:{i:{j:{k:{l:{h=b>>>12|0;switch(h|0){case 10:break g;case 9:break h;case 6:break i;case 2:case 3:break j;case 1:break k;case 0:break l;case 11:case 12:case 13:case 14:case 15:break f;default:break e}}g=b&255;m:{n:{o:{switch(f|0){case 13:if(g){break n}f=d;b=0;break m;case 0:f=d;p:{switch(g-1|0){case 1:break a;case 0:break b;default:break p}}K[k+20>>2]=Ve(k+75|0,K[p>>2]);K[k+16>>2]=b;Na(t,85851,k+16|0);break a;case 5:if(L[K[(L[c+34|0]<<2)+144464>>2]+11|0]!=2){break a}K[i+20>>2]=g;break a;case 12:break o;default:break d}}K[i+44>>2]=K[i+44>>2]+(b<<24>>31&-256|g);break a}I[i+132|0]=L[d+3|0];f=d+2|0;I[i+133|0]=L[f|0];b=2;if(g>>>0<3){break m}I[i+134|0]=L[d+5|0];f=d+4|0;I[i+135|0]=L[f|0];b=4;if(g>>>0<5){break m}I[i+136|0]=L[d+7|0];f=d+6|0;I[i+137|0]=L[f|0];b=6;if(g>>>0<7){break m}I[i+138|0]=L[d+9|0];f=d+8|0;I[i+139|0]=L[f|0];b=8;if(g>>>0<9){break m}I[i+140|0]=L[d+11|0];f=d+10|0;I[i+141|0]=L[f|0];b=10;if(g>>>0<11){break m}I[i+142|0]=L[d+13|0];f=d+12|0;I[i+143|0]=L[f|0];b=12;if(g>>>0<13){break m}I[i+144|0]=L[d+15|0];f=d+14|0;I[i+145|0]=L[f|0];b=14;if(g>>>0<15){break m}I[i+146|0]=L[d+17|0];f=d+16|0;I[i+147|0]=L[f|0];b=16}I[(b+i|0)+132|0]=0;g=n;break b}if(!a|f>>>0>7){break a}h=c;if(L[K[(L[c+2|0]<<2)+144464>>2]+11|0]!=2){h=s;if(L[K[(L[c+34|0]<<2)+144464>>2]+11|0]!=2){break a}}f=K[a+56>>2];if(f&1?0:L[c|0]&16){break a}g=L[h+3|0]&15;g=f&2?L[h+6|0]<=g>>>0?4:g:g;q:{r:{s:{t:{f=l&7;switch(f-3|0){case 1:break r;case 0:break t;default:break s}}if(g>>>0>3){break q}break a}if(K[(f<<2)+102832>>2]>(g|0)){break q}break a}if(L[h+6|0]>g>>>0){break a}}K[i+8>>2]=b&255;g=1;break c}u:{if((b&57344)!=8192){break u}C=K[32972];l=1;u=0;while(1){j=b&255;m=b&4095;f=m>>>8|0;v:{if(m>>>0<=3583){g=(f>>>0)%7|0;if((g|0)==6){g=M[d+2>>1]}q=0;f=c;w:{x:{y:{switch(g|0){case 6:h=0;if(M[c+36>>1]|M[c+68>>1]){break v}case 3:f=w;break x;case 9:h=0;if(M[c+36>>1]|M[c+68>>1]){break v}f=x;if(!M[c+100>>1]){break w}break v;case 7:h=0;if(M[c+36>>1]){break v}g=1;while(1){f=(g<<5)+c|0;if(L[K[(L[f+2|0]<<2)+144464>>2]+11|0]==2){break x}g=g+1|0;if(!M[((g<<5)+c|0)+4>>1]){continue}break};break v;case 5:h=0;if(M[c+4>>1]){break v}case 0:q=1;f=v;break x;case 4:h=0;if(M[c+36>>1]){break v}case 2:f=s;break x;case 8:h=0;if(!e){break v}q=1;f=e;if(K[f+8>>2]){break w}break v;case 10:break y;default:break x}}h=0;if(M[c+4>>1]|M[z>>1]){break v}q=1;f=y;break w}z:{switch(g|0){case 0:case 5:break z;default:break w}}f=(L[f+2|0]==1?-32:0)+f|0}A:{if(!r){g=K[f+8>>2];break A}g=K[(L[f+2|0]<<2)+144464>>2];K[f+8>>2]=g}if(m>>>0<=1791){h=1;if(K[K[(j<<2)+144464>>2]>>2]==K[g>>2]){break v}if(!(!q|L[g+11|0]!=2)){h=(j|0)==L[g+13|0];break v}h=(j|0)==L[g+12|0];break v}j=m&31;h=0;B:{switch(m>>>5&7){case 0:h=(j|0)==L[g+11|0];break v;case 1:h=(j|0)==(M[g+6>>1]&15);break v;case 2:h=K[g+4>>2]>>>j&1;break v;case 4:break B;default:break v}}C:{switch(j|0){case 0:case 1:case 2:case 3:case 4:if(L[K[(L[f+2|0]<<2)+144464>>2]+11|0]!=2){if(L[K[(L[f+34|0]<<2)+144464>>2]+11|0]!=2){break v}f=f+32|0}g=L[f+3|0]&15;g=!a|!(L[a+56|0]&2)?g:L[f+6|0]<=g>>>0?4:g;D:{E:{switch(j-3|0){case 1:h=L[f+6|0]<=g>>>0;break v;case 0:h=1;if(g>>>0<=3){break D}break v;default:break E}}h=1;if(K[(j<<2)+102832>>2]>(g|0)){break v}}h=0;break v;case 17:if(!L[g+11|0]){h=1;break v}h=(L[c+1|0]&32)>>>5|0;break v;case 18:h=M[f+4>>1]!=0;break v;case 19:h=1;if(M[f+36>>1]){break v}h=!L[K[f+40>>2]+11|0];break v;case 9:if(M[f+4>>1]){break v}while(1){g=L[f-29|0]&12;h=(g|0)!=0;if(g){break v}f=f-32|0;if(!M[f+4>>1]){continue}break};break v;case 10:h=L[g+11|0]!=2;break v;case 11:while(1){g=M[f+36>>1];h=(g|0)!=0;if(g){break v}g=f;f=f+32|0;if(L[K[g+40>>2]+11|0]!=2){continue}break};break v;case 12:h=1;if((L[g+11|0]&254)==2){break v}h=(L[g+4|0]&16)>>>4|0;break v;case 13:while(1){h=(L[K[f+8>>2]+11|0]==2)+h|0;g=M[f+4>>1];f=f-32|0;if(!g){continue}break};h=(h|0)==1;break v;case 14:while(1){h=(L[K[f+8>>2]+11|0]==2)+h|0;g=M[f+4>>1];f=f-32|0;if(!g){continue}break};h=(h|0)==2;break v;case 16:break C;default:break v}}h=(L[f|0]&16)>>>4|0;break v}h=0;if((f|0)!=15){break v}F:{switch(j-1|0){case 0:h=A;break v;case 1:break F;default:break v}}h=K[C+132>>2]!=0}g=b&65535;f=g>>>12|0;G:{if(1970>>>f&1){f=I[f+102848|0];break G}H:{switch(f|0){case 0:f=1;if((g&3840)!=3328){break G}f=((g&255)+1>>>1|0)+1|0;break G;case 6:f=(g>>>9&7)-5>>>0<2?12:1;break G;case 2:case 3:f=g&3840;f=(f|0)==3328?2:(f|0)==1536?2:1;break G;default:break H}}g=M[d+4>>1];f=4;if(g>>>0>61439){break G}f=(g|0)==2?3:2}d=(f<<1)+d|0;f=M[d>>1]==3;d=(f<<1)+d|0;f=f^h;l=u?f|l:f&l;u=b&4096;b=M[d>>1];if((b&57344)==8192){continue}break}if(l&1){break u}if((b&63488)==26624){d=((b&255)<<1)+d|0;break u}f=b>>>12|0;I:{if(1970>>>f&1){f=I[f+102848|0];break I}J:{switch(f|0){case 0:f=1;if((b&3840)!=3328){break I}f=((b&255)+1>>>1|0)+1|0;break I;case 6:f=(b>>>9&7)-5>>>0<2?12:1;break I;case 2:case 3:b=b&3840;f=(b|0)==3328?2:(b|0)==1536?2:1;break I;default:break J}}b=M[d+4>>1];f=4;if(b>>>0>61439){break I}f=(b|0)==2?3:2}b=(f<<1)+d|0;d=(((M[b>>1]&65024)==24576)<<1)+b|0}f=d-2|0;g=n;break b}K:{switch(f>>>1|0){case 0:d=(((b&255)<<1)+d|0)-2|0;break a;case 5:K[i>>2]=K[i>>2]|2;b=L[K[c+40>>2]+12|0];if((b-28&255)>>>0<=5){b=((b<<2)+d|0)-112|0;f=M[b+4>>1];b=M[b+2>>1];K[i+96>>2]=b>>>4<<24>>24;K[i+76>>2]=(b&15)<<18|f<<2}d=d+24|0;break a;case 6:break K;default:break a}}b=L[K[B>>2]+13|0];if((b-28&255)>>>0<=5){b=((b<<2)+d|0)-112|0;f=M[b+4>>1];b=M[b+2>>1];K[i+100>>2]=b>>>4<<24>>24;K[i+80>>2]=(b&15)<<18|f<<2}d=d+24|0;break a}d=d+2|0;b=M[d>>1]|b<<16&983040;L:{switch(f-1|0){case 0:if((o|0)>9){break a}K[(k+32|0)+(o<<2)>>2]=d;d=(K[34459]+(b<<1)|0)-2|0;o=o+1|0;break a;case 1:K[i+124>>2]=b;break a;case 2:break L;default:break a}}K[i+128>>2]=b;break a}f=(((f|0)!=1)<<3)+i|0;K[f+108>>2]=M[d+2>>1]|(b&255)<<16;b=M[d+4>>1]<<16;d=d+6|0;K[f+112>>2]=b|M[d>>1];break a}f=d+2|0;g=M[f>>1];j=h-11|0;l=(j<<2)+i|0;m=b>>>4|0;K[l+88>>2]=m&255;K[l+68>>2]=b<<18&3932160|g<<2;d=M[d+4>>1];if((d|0)==2){d=f;break a}g=b>>>0<=53247?d>>>0>61439?2:1:n-((j|0)==4)|0;if(h-13>>>0>1){break b}K[l+88>>2]=m<<24>>24;break b}K[k+4>>2]=Ve(k+75|0,K[p>>2]);K[k>>2]=b;Na(t,85851,k);break a}K[((f<<2)+i|0)+4>>2]=g;g=r?(f|0)==1?1:n:n}f=d}if(!((g|0)!=1|(o|0)<=0)){o=o-1|0;d=K[(k+32|0)+(o<<2)>>2];n=0;break a}d=f;n=g}d=d+2|0;if((n|0)!=1){continue}break}if(!(!e|L[c+17|0]!=2)){a=K[c+4>>2];K[e>>2]=K[c>>2];K[e+4>>2]=a;a=K[c+28>>2];K[e+24>>2]=K[c+24>>2];K[e+28>>2]=a;a=K[c+20>>2];K[e+16>>2]=K[c+16>>2];K[e+20>>2]=a;a=K[c+12>>2];K[e+8>>2]=K[c+8>>2];K[e+12>>2]=a}I[c+23|0]=K[i+44>>2];a=K[i+68>>2];M:{if(a){K[c+24>>2]=a;a=i+88|0;break M}K[c+24>>2]=K[i+72>>2];a=i+92|0}K[c+28>>2]=K[a>>2]}sa=k+80|0}function Dd(a,b,c,d,e,f){var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0;g=sa-848|0;sa=g;a:{if(!K[a+104>>2]|(L[e+2|0]&8|K[47202]==193)){break a}K[d>>2]=0;K[33272]=0;K[33274]=f;I[g+192|0]=0;K[33273]=g+192;while(1){f=k;k=f+1|0;s=b+f|0;if(I[s|0]-48>>>0<10){continue}break}K[56798]=0;w=g+188|0;m=-2147483648;r=sa-16|0;sa=r;h=L[b|0];b:{if(!h){l=b;break b}l=b;c:{while(1){h=h<<24>>24;if(!((h|0)==32|h-9>>>0<5)){break c}h=L[l+1|0];l=l+1|0;if(h){continue}break}break b}d:{h=L[l|0];switch(h-43|0){case 0:case 2:break d;default:break b}}p=(h|0)==45?-1:0;l=l+1|0}while(1){e:{h=-48;n=I[l|0];f:{if((n-48&255)>>>0<10){break f}h=-87;if((n-97&255)>>>0<26){break f}h=-55;if((n-65&255)>>>0>25){break e}}n=h+n|0;if((n|0)>=10){break e}Ua(r,10,0,0,0,o,q,0,0);h=1;g:{if(K[r+8>>2]|K[r+12>>2]){break g}u=vg(o,q,10,0);v=va;if((v|0)==-1&(n^-1)>>>0<u>>>0){break g}h=v;o=n+u|0;q=o>>>0<n>>>0?h+1|0:h;t=1;h=j}l=l+1|0;j=h;continue}break}if(w){K[w>>2]=t?l:b}h:{i:{j:{if(j){K[56798]=68;o=-2147483648;q=0;break j}if(!q&o>>>0<2147483648){break i}}if(!p){K[56798]=68;m=2147483647;break h}if(!q&o>>>0<=2147483648){break i}K[56798]=68;break h}m=(p^o)-p|0}sa=r+16|0;p=m;if(K[56798]|K[g+188>>2]==(b|0)){break a}k:{l:{m:{n=L[a+109|0]&64?4:3;if(!(!((n|0)!=(f|0)|K[a+124>>2]!=I[b-2|0])&I[b-3|0]-48>>>0<10)){n:{if(K[a+124>>2]!=32){if(!(L[a+105|0]&16)){break m}if((f|0)==3){break n}break m}if((f|0)!=3){break m}}if(L[e+2|0]&4|I[b-2|0]-48>>>0>=10){break m}}I[133104]=0;I[g+288|0]=0;x=1;break l}I[133104]=0;K[33275]=0;I[g+288|0]=0;y=1;t=0;if(L[b|0]==48){break k}}t=Ed(a,b,s,e,0)}if(!(L[s|0]!=46|I[b+k|0]-48>>>0<10|(I[e+13|0]&1|I[s+2|0]-48>>>0<10))){I[s|0]=0}o:{if(t){u=1;if(K[a+212>>2]!=26741){break o}}m=g+256|0;K[g+844>>2]=m;i=k;if(L[e+1|0]&64){I[g+256|0]=45;m=g+256|1;K[g+844>>2]=m;i=f+2|0}l=L[b+i|0];if(l){while(1){if(!((l&255)==32|(i|0)>28)){h=K[g+844>>2];K[g+844>>2]=h+1;I[h|0]=l;i=i+1|0;l=L[i+b|0];if(l){continue}}break}m=K[g+844>>2]}I[m|0]=0;u=1;h=I[g+256|0];if(!h){break o}j=K[a+136>>2];p:{if(j){if(!Oa(g+256|0,j)){break p}}if(h-48>>>0<10){break o}K[g+176>>2]=g+256;h=g+800|0;Aa(h,88653,g+176|0);if(!Da(a,h,133104)){break o}K[d>>2]=K[d>>2]|128;K[g+160>>2]=g+256;h=g+800|0;Aa(h,88773,g+160|0);Da(a,h,133116);u=0}t=2}w=K[e>>2];I[g+352|0]=0;I[g+624|0]=0;q:{r:{s:{if(!y|L[b|0]!=48){break s}h=I[b+1|0];if((h|0)==32|(h|0)==K[a+128>>2]){break s}t:{if((f|0)==2){if(L[b+3|0]!=58|I[b+5|0]-48>>>0>=10){break t}h=I[b+7|0];if(!((h|0)==32|h-9>>>0<5)){break t}break s}if((f|0)>3){break r}}if(L[b|0]!=48){break s}h=f-1|0;if((h|0)<=0){break s}i=0;while(1){j=g+288|0;Da(a,88875,Ba(j)+j|0);i=i+1|0;if(L[i+b|0]!=48){break s}if((h|0)>(i|0)){continue}break}}h=I[s|0];u:{v:{if(!((h|0)==32?L[a+105|0]&16:0)){v=2;o=f+2|0;if((h|0)==K[a+124>>2]){break v}q=1;m=0;h=0;break u}v=1;o=f+2|0}if(L[e+14|0]&4){m=1;h=0;q=1;break u}h=0;l=1;i=f;q=1;while(1){j=h;h=l;r=i+v|0;l=r+b|0;i=0;w:{while(1){x:{m=1;if(I[i+l|0]-48>>>0>=10){break x}i=i+1|0;if((n|0)!=(i|0)){continue}break w}break}h=j;break u}if(I[l+n|0]-48>>>0<10){h=j;break u}i=0;if(I[l-1|0]-48>>>0<10){h=j;break u}y:{while(1){if(L[(i+r|0)+b|0]==48){i=i+1|0;if((n|0)!=(i|0)){continue}break y}break}q=0}i=n+r|0;j=I[i+b|0];if((j|0)!=K[a+124>>2]&(!(L[a+105|0]&16)|(j|0)!=32)){break u}o=i+2|0;l=h+1|0;if(!(L[(Q(l,12)+e|0)+2|0]&4)){continue}break}}i=!p;z:{if(!q|(!(L[(Q(h,12)+e|0)+1|0]&64)|K[a+212>>2]!=26741)){break z}A:{j=b+o|0;switch(L[j|0]-97|0){case 0:case 4:break A;default:break z}}B:{C:{D:{E:{l=L[j+1|0];switch(l-116|0){case 6:break z;case 1:case 2:case 3:case 4:case 5:break C;case 0:break E;default:break D}}if(L[j+2|0]!=116){break B}break z}if((l|0)==32){break z}}if(((p|0)%1e3|0)!=0&(h|0)!=1){break B}if((l|0)==108){break z}}K[33274]=K[33274]|1}o=w&32768;i=i&x;F:{if(!(K[a+128>>2]!=I[s|0]|I[b+k|0]-48>>>0>=10)){Da(a,88882,g+624|0);j=0;l=256;break F}G:{if(!i){i=0;j=1;if(!((h|0)>0&m)){break G}k=Cd(a,p,h,q,g+624|0);p=k?0:p;i=(k|0)!=0;l=0;break F}i=1;p=0;H:{if(K[33275]!=1){break H}K[g+144>>2]=h+1;k=g+800|0;Aa(k,89026,g+144|0);if(Da(a,k,g+688|0)){break H}K[g+128>>2]=h;k=g+800|0;Aa(k,89026,g+128|0);Da(a,k,g+624|0)}}j=1;l=0}m=o?2:t;I:{J:{if(!(h|(L[g+624|0]|L[s|0]!=46))){Da(a,89192,g+624|0);break J}if(h){break I}}K[g+844>>2]=b;if(I[b+1|0]-48>>>0<10){while(1){k=K[g+844>>2];K[g+844>>2]=k+1;if(I[k+2|0]-48>>>0<10){continue}break}}K:{if(I[K[g+844>>2]-1|0]-48>>>0>=10){break K}K[g+416>>2]=K[g+844>>2]-1;if(!Wa(a,g+416|0,g+192|0,d,4,e)){break K}K[33272]=2}L:{if(L[g+192|0]|L[K[g+844>>2]]==48){break L}if(!Wa(a,g+844|0,g+192|0,d,4,e)){break L}K[33272]=1}if(!y){break I}if(!m&j){K[g+112>>2]=p;e=g+800|0;Aa(e,89214,g+112|0);if(Da(a,e,c)){break q}}if(!(I[a+110|0]&1)){break I}k=b;while(1){if((L[k|0]|32)!=32){k=k+1|0;continue}break}K[g+416>>2]=k;if(L[k+1|0]!=37){break I}Da(a,89328,c);e=Ba(c);I[K[g+416>>2]+1|0]=32;c=c+e|0}Kc(a,p,g+416|0,i,h,m|(l|x));M:{if(!(!(L[a+109|0]&2)|(h|0)<=0)){K[g+88>>2]=15;K[g+96>>2]=g+416;K[g+92>>2]=g+352;K[g+84>>2]=g+624;K[g+80>>2]=g+288;Aa(c,89346,g+80|0);break M}K[g+60>>2]=15;K[g- -64>>2]=g+624;K[g+56>>2]=g+416;K[g+52>>2]=g+352;K[g+48>>2]=g+288;Aa(c,89415,g+48|0)}N:{if(j){break N}while(1){f=f+1|0;j=0;while(1){k=j;j=k+1|0;h=f+k|0;if(I[h+b|0]-48>>>0<10){continue}break}e=2;O:{P:{Q:{R:{S:{T:{j=K[a+104>>2]&57344;switch(j+-8192>>>13|0){case 6:break P;case 2:break Q;case 0:case 4:case 5:break R;case 1:break S;case 3:break T;default:break O}}e=5}i=b+f|0;j=L[i|0];if((j|0)==48){while(1){h=g+688|0;Da(a,88875,h);Za(c,h);k=k-1|0;f=f+1|0;i=f+b|0;j=L[i|0];if((j|0)==48){continue}break}}if((e|0)<(k|0)|(j<<24>>24)-48>>>0>=10){break O}e=g+688|0;Kc(a,Kb(i),e,0,0,0);Za(c,e);f=f+k|0;break O}e=b+f|0;Kc(a,Kb(e),g+416|0,0,0,0);if(!((j|0)==8192&L[e|0]!=48)){K[g+16>>2]=k;e=g+800|0;Aa(e,89508,g+16|0);if(!Da(a,e,g+688|0)){break O}Za((j|0)==49152?c:g+416|0,g+688|0)}Za(c,g+416|0);f=h;break O}if((k|0)>4){break O}e=b+f|0;if(L[e|0]==48){break O}f=Kb(e);e=g+688|0;Kc(a,f,e,0,0,0);Za(c,e);f=h;break O}if((k|0)<=1){break O}while(1){K[g+32>>2]=I[b+f|0];e=g+800|0;Aa(e,89575,g+32|0);if(!Da(a,e,g+688|0)){break O}Za(c,g+688|0);f=f+1|0;k=k-1|0;if((k|0)>1){continue}break}}k=b+f|0;j=L[k|0];U:{if(j-48>>>0>=10){break U}if(Ba(c)>>>0>=190){break U}while(1){e=g+688|0;Jc(a,I[k|0]-48|0,0,2,e);h=Ba(c);K[g>>2]=15;K[g+4>>2]=e;Aa(c+h|0,89594,g);f=f+1|0;k=f+b|0;j=L[k|0];if(j-48>>>0>=10){break U}if(Ba(c)>>>0<=189){continue}break}}if(Da(a,89678,g+688|0)){Za(c,g+688|0)}if(K[a+128>>2]!=(j|0)|I[(b+f|0)+1|0]-48>>>0>=10){break N}e=g+688|0;Da(a,88882,e);Za(c,e);continue}}e=L[c|0];V:{if(!e|(e|0)==21){break V}b=(b+f|0)+1|0;e=Ga(g+184|0,b);f=K[g+184>>2];if(!(!(L[a+106|0]&2)|(f|0)!=32)){Ga(g+184|0,b+e|0);f=K[g+184>>2]}if(pb(f)|q){break V}a=Ba(c)+c|0;I[a|0]=11;I[a+1|0]=0}K[d>>2]=K[d>>2]|-2147483648;K[33275]=K[33275]-1;i=1;if(u){break a}K[33264]=1;break a}K[d>>2]=K[d>>2]&-129;i=0;break a}i=1}sa=g+848|0;return i}function qd(a,b,c,d){var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0;j=sa-416|0;sa=j;t=M[c+8>>1];o=L[c+10|0];n=K[c>>2];if(n&64){K[c>>2]=n&-65;I[199388]=1;g=K[47202];l=K[49846];i=K[47352];k=K[47351];h=K[47350];while(1){f=K[(k<<2)+198304>>2];e=f>>8;a:{b:{switch((f&31)-9|0){case 0:g=e;break a;case 4:l=e;break a;case 3:break b;default:break a}}i=f>>>0>=256?e+i|0:0}k=k+1|0;if(!(f&128)&(h|0)>(k|0)){continue}break}K[47352]=i;K[47351]=k;K[49846]=l;K[47202]=g}l=0;e=K[49572];c:{if((e|0)>997){break c}if(!(n&1048576?0:L[b|0])){if(L[199388]){K[49572]=e+1;I[199388]=0;a=(e<<3)+190288|0;K[a>>2]=983042;K[a+4>>2]=0}I[189088]=0;break c}if((e|0)>990){break c}e=K[a+8224>>2];if((e|0)>0){K[a+8224>>2]=e-1}g=n&512?d:d+4|0;i=(K[47202]&240)==16;r=n&2;d:{if(!r){break d}f=K[47200];if((f|0)<3){break d}e=K[47350];if((e|0)>243){break d}if(L[199388]){k=(e<<2)+198300|0;K[k>>2]=K[k>>2]&-129}K[47350]=e+1;I[199388]=1;u=(f|0)==3?20:f;K[(e<<2)+198304>>2]=u<<8|193}h=i?g:d;e:{f:{if(!(n&8)){while(1){g:{e=m;d=L[e+b|0];I[e+(j+240|0)|0]=d;if(!(d&223)){break g}m=e+1|0;if(e>>>0<160){continue}}break}I[j+66|0]=0;m=j- -64|2;l=jc(K[47192],b,c,m);K[j+412>>2]=l;if(!(l&4096)){break f}Fa(b,j+240|0,e);break c}h:{if(!$a(b,87276,3)){k=0;m=b+3|0;e=L[m|0];if(e&223){while(1){I[(j+240|0)+k|0]=xb(e<<24>>24);k=k+1|0;m=m+1|0;e=L[m|0];if(e&223){continue}break}}d=j+240|0;I[d+k|0]=0;e=0;c=K[34461];i:{if((c|0)<=0){break i}while(1){if(!Oa(d,Q(e,44)+137856|0)){K[34457]=e;break i}e=e+1|0;if((c|0)!=(e|0)){continue}break}e=c}c=(c|0)==(e|0)?-1:e;if((c|0)<=0){break h}ab(c);I[189090]=0;I[189089]=c;I[189088]=21;break h}Rc(b,189088,j+240|0)}l=-2147483648;K[j+412>>2]=-2147483648;d=-1;break e}if(!(!(l&8388608)|L[c+12|0]&8)){i=sa-208|0;sa=i;k=K[a+60>>2];f=b;while(1){d=f;f=f+1|0;if(L[d|0]!=32){continue}break}Ga(i+204|0,f);j:{if(!pb(K[i+204>>2])){break j}g=Ca(i,189088);q=Mb(a,f,c+12|0,0);f=(!(k&256)|q>>>15)&!(q&67108864)&L[189088]!=21;k:{l:{if(k&512){if(!(f&!(L[c+12|0]&16))){break l}break k}if(f){break k}}Ca(189088,g);break j}I[d|0]=45;K[c>>2]=K[c>>2]&-2;l=0;f=189088;p=Mb(K[47192],b,c,0);K[j+412>>2]=p;m:{if((k|0)<=0){break m}g=L[189088];if(!g){break m}while(1){l=(L[K[(g<<2)+144464>>2]+11|0]==2)+l|0;f=f+1|0;g=L[f|0];if(g){continue}break}if((k&31)>=(l|0)){break m}I[d|0]=32;K[j+412>>2]=Mb(K[47192],b,c,0);break j}K[j+412>>2]=(p?p:q)|128;K[33264]=1}sa=i+208|0}d=-1;n:{if(L[189088]!=21){break n}k=Ca(j+16|0,132848);i=K[j+412>>2];f=Fa(b,j+240|0,e);g=j- -64|1;d=Ec(L[189089]?189089:87315,188772,189296);o:{if((d|0)<0){break o}K[c>>2]=K[c>>2]|4194304;if(L[j+66|0]){J[j+64>>1]=8192;i=Mb(K[47193],g,c,0);break o}i=jc(K[47193],f,c,m)}if(L[189088]==21){e=Fa(f,j+240|0,e);d=Ec(L[189089]?189089:87315,188772,189296);p:{if((d|0)<0){break p}K[c>>2]=K[c>>2]|4194304;if(L[j+66|0]){J[j+64>>1]=8192;i=Mb(K[47193],g,c,0);break p}i=jc(K[47193],e,c,m)}l=4096;if(L[189088]==21){break c}}K[j+412>>2]=i;if((d|0)>=0){break n}I[189090]=0;J[94544]=3341;if((d|0)!=-1){break n}Ca(132848,k);ab(K[K[32972]+60>>2]);d=K[K[32972]+60>>2]}l=K[j+412>>2];q:{if(n&128){break q}h=l&268435456?(h|0)<=1?1:h:h;if(!(l&256)|n&528|(K[a+8224>>2]|L[c-11|0]&2)){break q}K[a+8224>>2]=3;h=(h|0)<=4?4:h}h=(h|0)<=0?K[49846]>2?1:h:h}c=L[199388];m=K[49572];if(!((h|0)<=0|(m|0)>990)){K[49572]=m+1;f=c&1;c=0;e=(m<<3)+190288|0;J[e>>1]=f?2:0;I[e+7|0]=0;I[e+3|0]=0;f=h>>>0>1;I[e+2|0]=f?9:11;J[e+4>>1]=0;K[a+8236>>2]=0;e=f?h-2|0:0;m=K[49572];r:{if(!e|(m|0)>990){break r}g=a+8236|0;while(1){K[49572]=m+1;f=(m<<3)+190288|0;J[f>>1]=0;I[f+7|0]=0;I[f+3|0]=0;i=e>>>0>1;I[f+2|0]=i?9:11;J[f+4>>1]=0;K[g>>2]=0;m=K[49572];e=i?e-2|0:0;if((e|0)<=0){break r}if((m|0)<991){continue}break}}K[a+8228>>2]=0;K[a+8232>>2]=0}I[199388]=c&1;s:{if(!r|K[47200]!=1){break s}K[49572]=m+2;I[199388]=0;e=(m<<3)+190288|0;J[e>>1]=c&1?2:0;I[e+7|0]=0;J[e+2>>1]=10;J[e+4>>1]=0;J[e+12>>1]=0;K[e+8>>2]=1179648;I[e+15|0]=0;if(!(n&1)){break s}if(!Ma(I[b+1|0])){break s}c=L[199388];I[199388]=0;b=K[49572];K[49572]=b+2;b=(b<<3)+190288|0;J[b>>1]=c?2:0;I[b+7|0]=0;J[b+2>>1]=10;J[b+4>>1]=0;J[b+12>>1]=0;K[b+8>>2]=1179648;I[b+15|0]=0}e=o>>>0<31;t:{if((d|0)<0){break t}b=K[49572];h=b-1|0;c=L[(h<<3)+190290|0];if(!(L[189088]!=9|L[189089]!=21)){if((c|0)!=21){break t}K[49572]=h;break t}if((c|0)!=21){f=L[199388];I[199388]=0;c=(b<<3)+190288|0;I[c+7|0]=0;J[c+2>>1]=21;J[c+4>>1]=0;J[c>>1]=f?2:0;h=b}K[49572]=h+1;I[(h<<3)+190295|0]=d}b=t&2047;c=(e?o:31)<<11;v=n&128;i=v?L[K[(L[189088]<<2)+144464>>2]+11|0]?189088:189089:189088;h=L[i|0];if(!(h|!(I[199388]&1))){h=23;I[i|0]=23;I[i+1|0]=0}w=b|c;g=K[49572];u:{if(!h){b=0;break u}if((g|0)>994){b=0;break u}z=((l&-1610612736)==-2147483648)<<4;t=w+1|0;A=a+8233|0;b=0;f=1;q=0;x=1;o=-1;r=-1;e=0;while(1){k=i+1|0;v:{p=h&255;if((p|0)!=255){c=K[(p<<2)+144464>>2];if(c){break v}K[j>>2]=p;c=sa-16|0;sa=c;K[c+12>>2]=j;Yc(132552,87474,j);sa=c+16|0;g=K[49572]}h=L[k|0];if(!h){break u}i=k;if((g|0)<995){continue}break u}s=h&255;w:{if((s|0)==21){c=(g<<3)+190288|0;K[c>>2]=1376256;J[c+4>>1]=0;I[c+7|0]=L[i+1|0];K[49572]=g+1;ab(L[i+1|0]);k=i+2|0;g=K[49572];c=e;break w}i=L[c+11|0];if((i|0)==1){if(!M[c+8>>1]){f=L[c+14|0];c=e;break w}if((o|0)<0){c=e;q=p;break w}I[(o<<3)+190295|0]=h;c=e;break w}c=t;x:{switch(s-12|0){case 8:o=g-1|0;c=(o<<3)+190288|0;I[c+3|0]=f;J[c>>1]=M[c>>1]|4;c=e;break w;case 0:c=(g<<3)+190280|0;J[c>>1]=M[c>>1]|8;c=e;break w;case 10:l=l|16384;K[j+412>>2]=l;c=e;break w;case 3:break w;default:break x}}p=L[199388];I[199388]=0;s=g<<3;c=s+190288|0;I[c+7|0]=0;I[c+2|0]=h;J[c+4>>1]=e;e=(p?2:0)|z;J[c>>1]=e;y:{z:{if((i|0)==2){if((f|0)>=4){I[189076]=1}A:{if((o|0)<0){break A}b=g-1|0;if((b|0)==(o|0)){break A}I[(b<<3)+190291|0]=f}J[c>>1]=e|4;b=(f|0)>(r|0);y=b?g:y;r=b?f:r;e=1;if(!q){break z}I[c+7|0]=q;break z}if(!(!x|!(L[A|0]&64))){J[c>>1]=e|8}e=f;break y}o=g;q=0;b=f}g=g+1|0;K[49572]=g;I[s+190291|0]=b;c=0;x=0;f=e}h=L[k|0];if(!h){break u}i=k;e=c;if((g|0)<995){continue}break}}if(n&131072){c=g+1|0;K[49572]=c;f=L[199388];I[199388]=0;e=(g<<3)+190288|0;I[e+7|0]=0;J[e+2>>1]=27;J[e+4>>1]=0;J[e>>1]=f?2:0;g=c}if(!v){J[(m<<3)+190292>>1]=w}K[a+8228>>2]=0;if(!(L[K[(L[(g<<3)+190282|0]<<2)+144464>>2]+11|0]!=2|(b|0)<4)){K[a+8228>>2]=1}if((d|0)>=0){Ca(132848,j+16|0);ab(K[K[32972]+60>>2]);c=L[199388];I[199388]=0;d=K[49572];b=(d<<3)+190288|0;J[b>>1]=c?2:0;J[b+2>>1]=21;J[b+4>>1]=0;I[b+7|0]=K[K[32972]+60>>2];g=d+1|0;K[49572]=g}if((u|0)>0){I[199388]=0;K[49572]=g+1;b=(g<<3)+190288|0;K[b>>2]=655362;c=K[47350];K[47350]=c+1;I[b+7|0]=0;J[b+4>>1]=0;K[(c<<2)+198304>>2]=u<<8|225}if(l&1024){b=(y<<3)+190288|0;J[b>>1]=M[b>>1]|64}K[a+8232>>2]=l}sa=j+416|0;return l}function Mc(a,b,c,d,e){var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0;a:{if(!b){s=K[34455];b=s+Q(e,68)|0;g=L[b+24|0];i=L[b+25|0];b=K[33268];f=b+c|0;b:{if((b|0)<=0){break b}j=i-g<<8;j=(b|0)!=1?(j|0)/(b|0)|0:j;if((c|0)>=(f|0)){break b}k=j>>>0>255;l=j>>>8|0;b=g<<8;i=0-j>>>8|0;m=(j|0)<=0;while(1){c:{if(!m){g=Q(c,6)+a|0;I[g+2|0]=k|L[g+2|0];g=(b|0)/256|0;g=(g|0)>0?g:0;h=g>>>0>=254?254:g;g=g+l|0;g=g>>>0>=254?254:g;b=b+j|0;break c}g=K[(I[Q(c,6)+a|0]<<2)+101024>>2];g=(g|0)<(i|0)?i:g;p=(g|0)>=18?18:g;b=b+j|0;g=(b|0)/256|0;h=(g|0)>0?g:0;g=p+h|0;g=g>>>0>=254?254:g;h=h>>>0>=254?254:h}p=Q(c,6)+a|0;I[p+5|0]=h;I[p+4|0]=g;c=c+1|0;if((f|0)!=(c|0)){continue}break}}d:{if(!(L[188785]&2)){c=K[33270];break d}c=K[33271];K[33270]=c}i=c;b=s+Q(e,68)|0;l=L[b+33|0];e:{if((l|0)==255){break e}while(1){i=i-1|0;if((i|0)<(f|0)){i=c;break e}if(I[Q(i,6)+a|0]<4){continue}break}}if((c|0)>(f|0)){m=L[b+32|0];h=b+31|0;j=L[h|0];y=m-j<<8;g=y>>31;A=(g^y)-g|0;k=b+30|0;b=L[k|0];v=(b|0)==255;p=l<<8;u=j<<8;B=m<<8;r=s+Q(e,68)|0;C=(b|0)!=255;m=0;l=0;b=1;j=0;while(1){f:{g:{n=Q(f,6)+a|0;q=I[n|0];if(!(b&1)&(q|0)<4){break g}h:{if(((q|0)==5|b)&1){i:{if(!C){b=0;j=f;g=h;if((i|0)<=(f|0)){break i}while(1){l=I[Q(j,6)+a|0];g=h;if((l|0)>6){break i}b=((l|0)>3)+b|0;j=j+1|0;if((i|0)!=(j|0)){continue}break}g=h;break i}x=1;b=0;j=f+1|0;g=k;if((i|0)<=(j|0)){break i}while(1){l=I[Q(j,6)+a|0];g=k;if((l|0)>6){break i}b=((l|0)>3)+b|0;j=j+1|0;if((i|0)!=(j|0)){continue}break}g=k}l=L[g|0]<<8;z=0;g=L[r+34|0];j=(b|0)<(g|0)?b:g;if((j|0)<2){w=0;break h}w=(y|0)/(j-1|0)|0;break h}if((f|0)==(i|0)){v=2;l=p;break h}if(x){v=1;j=j+1|0;x=0;l=u;break h}if((j|0)>0){l=l+w|0;x=0;break h}x=0;l=(Q(I[(r+z|0)+16|0],A)>>6)+B|0;b=z+1|0;z=(b|0)<L[r+35|0]?b:0}j=j-1|0;if((q|0)<4){break g}g=f+1|0;b=g;j:{if((c|0)<=(f|0)){break j}while(1){if(I[Q(b,6)+a|0]>1){break j}b=b+1|0;if((c|0)>=(b|0)){continue}break}}I[n|0]=6;I[n+1|0]=L[r+26|0];m=0;o=L[r+27|0];f=(l|0)/256|0;f=(f|0)>0?f:0;I[n+5|0]=f>>>0>=254?254:f;f=f+o|0;I[n+4|0]=f>>>0>=254?254:f;t=b-g|0;break f}if((q|0)>=2){g=f+1|0;b=g;k:{if((c|0)<=(f|0)){break k}while(1){if(I[Q(b,6)+a|0]>1){break k}b=b+1|0;if((c|0)>=(b|0)){continue}break}}m=0;f=(l|0)/256|0;f=(f|0)>0?f:0;I[n+5|0]=f>>>0>=254?254:f;o=K[(q<<2)+100976>>2];I[n+2|0]=L[n+2|0]|o>>>31;q=f;f=o>>31;f=q+((f^o)-f|0)|0;f=(f|0)>0?f:0;I[n+4|0]=f>>>0>=254?254:f;t=b-g|0;break f}l:{if((t|0)<=1){o=I[(r+v|0)+36|0];b=0;break l}b=r+v|0;o=I[b+36|0];b=(I[b+39|0]-o|0)/(t-1|0)|0}g=K[(q<<2)+100976>>2];I[n+2|0]=L[n+2|0]|g>>>31;b=(((l|0)/256|0)+o|0)+Q(b,m)|0;b=(b|0)>0?b:0;I[n+5|0]=b>>>0>=254?254:b;q=g;g=g>>31;b=b+((q^g)-g|0)|0;b=(b|0)>0?b:0;I[n+4|0]=b>>>0>=254?254:b;m=m+1|0;g=f+1|0}f=g;b=0;if((c|0)!=(f|0)){continue}break}f=c}if(L[133068]){break a}g=Q(f,6)+a|0;m:{if(!K[33269]){h=s+Q(e,68)|0;b=L[h+44|0];i=L[h+43|0]-b|0;h=h+42|0;break m}h=s+Q(e,68)|0;b=L[h+47|0];i=L[h+46|0]-b|0;h=h+45|0}h=L[h|0];k=i>>31;k=((k^i)-k|0)+b|0;I[g+4|0]=k>>>0>=254?254:k;I[g+5|0]=b>>>0>=254?254:b;b=Q(f,6)+a|0;I[b+2|0]=L[b+2|0]|i>>>31;c=Q(c,6)+a|0;I[c+1|0]=h;b=f+1|0;if(L[c|0]==4){I[c|0]=6}c=d-b|0;if((c|0)<=0){break a}g=s+Q(e,68)|0;e=L[g+48|0];g=L[g+49|0]-e<<8;g=(c|0)!=1?(g|0)/(c|0)|0:g;if((b|0)>=(d|0)){break a}k=g>>>0>255;l=g>>>8|0;c=e<<8;e=0-g>>>8|0;m=(g|0)<=0;while(1){n:{if(!m){f=Q(b,6)+a|0;I[f+2|0]=k|L[f+2|0];f=(c|0)/256|0;f=(f|0)>0?f:0;i=f>>>0>=254?254:f;f=f+l|0;h=f>>>0>=254?254:f;c=c+g|0;break n}f=K[(I[Q(b,6)+a|0]<<2)+101024>>2];f=(e|0)>(f|0)?e:f;h=(f|0)>=18?18:f;c=c+g|0;f=(c|0)/256|0;f=(f|0)>0?f:0;i=h+f|0;h=i>>>0>=254?254:i;i=f>>>0>=254?254:f}f=Q(b,6)+a|0;I[f+5|0]=i;I[f+4|0]=h;b=b+1|0;if((d|0)!=(b|0)){continue}break}break a}r=e<<4;b=K[33268];g=b+c|0;o:{if((b|0)<=0){break o}i=r+129360|0;f=L[i|0];l=L[i+1|0]-f<<8;l=(b|0)!=1?(l|0)/(b|0)|0:l;if((c|0)>=(g|0)){break o}m=l>>>0>255;p=l>>>8|0;f=f<<8;i=0-l>>>8|0;u=(l|0)<=0;b=c;while(1){p:{if(!u){h=Q(b,6)+a|0;I[h+2|0]=m|L[h+2|0];h=(f|0)/256|0;k=(h|0)>0?h:0;h=k>>>0>=254?254:k;k=k+p|0;j=k>>>0>=254?254:k;f=f+l|0;break p}h=K[(I[Q(b,6)+a|0]<<2)+101024>>2];h=(h|0)<(i|0)?i:h;k=(h|0)>=18?18:h;f=f+l|0;h=(f|0)/256|0;h=(h|0)>0?h:0;k=k+h|0;j=k>>>0>=254?254:k;h=h>>>0>=254?254:h}k=Q(b,6)+a|0;I[k+5|0]=h;I[k+4|0]=j;b=b+1|0;if((g|0)!=(b|0)){continue}break}}q:{if(!(L[188785]&2)){i=K[33270];break q}i=K[33271];K[33270]=i}b=e<<4;f=b+129360|0;m=L[f+3|0];h=L[f+2|0];p=m-h<<8;u=K[f+4>>2];r:{if((c|0)>0){w=101056;s=5;k=(p|0)/(L[b+129368|0]-1|0)|0;break r}b=b+129360|0;w=K[b+12>>2];s=L[b+10|0];k=0}if((g|0)<(i|0)){l=(c|0)<=0;b=p>>31;q=(b^p)-b|0;n=(e<<4)+129360|0;h=h<<8;v=m<<8;m=0;while(1){s:{t:{j=Q(g,6)+a|0;f=I[j|0];if(!(l&1)&(f|0)<4){break t}c=0;b=g;u:{if(((f|0)==5|l)&1){while(1){k=I[Q(b,6)+a|0];if((k|0)<=6){c=((k|0)>3)+c|0;b=b+1|0;if((i|0)!=(b|0)){continue}}break}o=0;b=L[n+8|0];t=(b|0)>(c|0)?c:b;if((t|0)<2){k=0;m=h;break u}k=(p|0)/(t-1|0)|0;m=h;break u}if((t|0)>0){m=k+m|0;break u}m=v+(Q(q,I[o+w|0])>>6)|0;o=o+1|0;if((s|0)>(o|0)){break u}w=K[n+12>>2];o=0}t=t-1|0;if((f|0)<4){break t}I[j|0]=6;f=K[u+(f<<2)>>2];c=f>>31;b=(m|0)/256|0;b=(b|0)>0?b:0;c=b+((c^f)-c|0)|0;break s}if((f|0)==3){f=K[u+12>>2];c=f>>31;b=(m|0)/256|0;b=(b|0)>0?b:0;c=b+((c^f)-c|0)|0;break s}b=(m|0)/256|0;if((L[j-6|0]&63)>>>0>=3){f=K[u+(f<<2)>>2];c=f>>31;b=b-I[n+9|0]|0;b=(b|0)>0?b:0;c=b+((c^f)-c|0)|0;break s}f=K[u+(f<<2)>>2];c=f>>31;b=(b|0)>0?b:0;c=b+((c^f)-c|0)|0}I[j+5|0]=b>>>0>=254?254:b;l=0;b=(c|0)>0?c:0;I[j+4|0]=b>>>0>=254?254:b;I[j+2|0]=L[j+2|0]|f>>>31;g=g+1|0;if((i|0)!=(g|0)){continue}break}g=i}if(L[133068]){break a}if((e&268435455)==3){b=Q(g,6)+a|0;I[b+2|0]=L[b+2|0]|2}v:{if(!K[33269]){c=(e<<4)+100768|0;b=L[c+2|0];h=r+100768|0;c=L[c+1|0]-b|0;break v}f=(e<<4)+100768|0;b=L[f+5|0];h=f+3|0;c=L[f+4|0]-b|0}f=Q(g,6)+a|0;I[f+5|0]=b>>>0>=254?254:b;I[f+2|0]=L[f+2|0]|c>>>31;k=b;b=c>>31;b=k+((b^c)-b|0)|0;I[f+4|0]=b>>>0>=254?254:b;c=Q(i,6)+a|0;I[c+1|0]=L[h|0];b=g+1|0;if(L[c|0]==4){I[c|0]=6}c=d-b|0;if((c|0)<=0){break a}g=(e<<4)+100768|0;e=L[g+12|0];g=L[g+13|0]-e<<8;g=(c|0)!=1?(g|0)/(c|0)|0:g;if((b|0)>=(d|0)){break a}k=g>>>0>255;l=g>>>8|0;c=e<<8;e=0-g>>>8|0;m=(g|0)<=0;while(1){w:{if(!m){f=Q(b,6)+a|0;I[f+2|0]=k|L[f+2|0];f=(c|0)/256|0;f=(f|0)>0?f:0;i=f>>>0>=254?254:f;f=f+l|0;h=f>>>0>=254?254:f;c=c+g|0;break w}f=K[(I[Q(b,6)+a|0]<<2)+101024>>2];f=(e|0)>(f|0)?e:f;h=(f|0)>=18?18:f;c=c+g|0;f=(c|0)/256|0;f=(f|0)>0?f:0;i=h+f|0;h=i>>>0>=254?254:i;i=f>>>0>=254?254:f}f=Q(b,6)+a|0;I[f+5|0]=i;I[f+4|0]=h;b=b+1|0;if((d|0)!=(b|0)){continue}break}}}function Nb(){var a=0,b=0,c=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;n=K[36455];h=K[36454];if((n|0)!=(h|0)){m=K[36427];a:{if((m|0)<0|(h|0)==(m|0)){break a}i=m;k=K[((i<<4)+216192|0)+8>>2];b=k;b:{while(1){c=i-1|0;i=(c|0)<0?169:c;f=(i<<4)+216192|0;c=K[f>>2];if(c-5>>>0<2){break b}c:{if((c|0)<=4){if(K[f+12>>2]!=(b|0)){break b}c=M[f+4>>1];K[f+12>>2]=k;b=K[f+8>>2];a=M[b>>1];if(a&16){break c}p=a&32?(Q(c,12)>>>0)/10|0:c;d=0;c=b;g=0;while(1){a=M[b>>1];d:{if(g>>>0<3?a&8:0){break d}a=a<<16>>16;l=g<<1;j=J[(l+b|0)+2>>1];l=k+l|0;e=J[l+2>>1];o=j-e|0;j=(Q(p,(Q(K[(g<<2)+200944>>2],(o|0)>0?j+(e<<1)|0:(j<<1)+e|0)|0)/3e3|0)|0)/256|0;e:{if((o|0)>(j|0)){f:{if(d){break f}if((a|0)<0){c=b;break f}c=0;a=K[44469]+1|0;a=(a|0)<=169?a:0;K[44469]=a;d=a<<6;a=d+177888|0;if(!a){break f}c=M[b+4>>1]|M[b+6>>1]<<16;e=M[b>>1]|M[b+2>>1]<<16;J[a>>1]=e;J[a+2>>1]=e>>>16;J[a+4>>1]=c;J[a+6>>1]=c>>>16;c=M[b+60>>1]|M[b+62>>1]<<16;e=M[b+56>>1]|M[b+58>>1]<<16;J[a+56>>1]=e;J[a+58>>1]=e>>>16;J[a+60>>1]=c;J[a+62>>1]=c>>>16;c=M[b+52>>1]|M[b+54>>1]<<16;e=M[b+48>>1]|M[b+50>>1]<<16;J[a+48>>1]=e;J[a+50>>1]=e>>>16;J[a+52>>1]=c;J[a+54>>1]=c>>>16;c=M[b+44>>1]|M[b+46>>1]<<16;e=M[b+40>>1]|M[b+42>>1]<<16;J[a+40>>1]=e;J[a+42>>1]=e>>>16;J[a+44>>1]=c;J[a+46>>1]=c>>>16;c=M[b+36>>1]|M[b+38>>1]<<16;e=M[b+32>>1]|M[b+34>>1]<<16;J[a+32>>1]=e;J[a+34>>1]=e>>>16;J[a+36>>1]=c;J[a+38>>1]=c>>>16;c=M[b+28>>1]|M[b+30>>1]<<16;e=M[b+24>>1]|M[b+26>>1]<<16;J[a+24>>1]=e;J[a+26>>1]=e>>>16;J[a+28>>1]=c;J[a+30>>1]=c>>>16;c=M[b+20>>1]|M[b+22>>1]<<16;e=M[b+16>>1]|M[b+18>>1]<<16;J[a+16>>1]=e;J[a+18>>1]=e>>>16;J[a+20>>1]=c;J[a+22>>1]=c>>>16;c=M[b+12>>1]|M[b+14>>1]<<16;e=M[b+8>>1]|M[b+10>>1]<<16;J[a+8>>1]=e;J[a+10>>1]=e>>>16;J[a+12>>1]=c;J[a+14>>1]=c>>>16;I[d+177904|0]=0;J[a>>1]=M[a>>1]|32768;c=a}a=j+M[l+2>>1]|0;break e}if((0-j|0)<=(o|0)){break d}g:{if(d){break g}if((a|0)<0){c=b;break g}c=0;a=K[44469]+1|0;a=(a|0)<=169?a:0;K[44469]=a;d=a<<6;a=d+177888|0;if(!a){break g}c=M[b+4>>1]|M[b+6>>1]<<16;e=M[b>>1]|M[b+2>>1]<<16;J[a>>1]=e;J[a+2>>1]=e>>>16;J[a+4>>1]=c;J[a+6>>1]=c>>>16;c=M[b+60>>1]|M[b+62>>1]<<16;e=M[b+56>>1]|M[b+58>>1]<<16;J[a+56>>1]=e;J[a+58>>1]=e>>>16;J[a+60>>1]=c;J[a+62>>1]=c>>>16;c=M[b+52>>1]|M[b+54>>1]<<16;e=M[b+48>>1]|M[b+50>>1]<<16;J[a+48>>1]=e;J[a+50>>1]=e>>>16;J[a+52>>1]=c;J[a+54>>1]=c>>>16;c=M[b+44>>1]|M[b+46>>1]<<16;e=M[b+40>>1]|M[b+42>>1]<<16;J[a+40>>1]=e;J[a+42>>1]=e>>>16;J[a+44>>1]=c;J[a+46>>1]=c>>>16;c=M[b+36>>1]|M[b+38>>1]<<16;e=M[b+32>>1]|M[b+34>>1]<<16;J[a+32>>1]=e;J[a+34>>1]=e>>>16;J[a+36>>1]=c;J[a+38>>1]=c>>>16;c=M[b+28>>1]|M[b+30>>1]<<16;e=M[b+24>>1]|M[b+26>>1]<<16;J[a+24>>1]=e;J[a+26>>1]=e>>>16;J[a+28>>1]=c;J[a+30>>1]=c>>>16;c=M[b+20>>1]|M[b+22>>1]<<16;e=M[b+16>>1]|M[b+18>>1]<<16;J[a+16>>1]=e;J[a+18>>1]=e>>>16;J[a+20>>1]=c;J[a+22>>1]=c>>>16;c=M[b+12>>1]|M[b+14>>1]<<16;e=M[b+8>>1]|M[b+10>>1]<<16;J[a+8>>1]=e;J[a+10>>1]=e>>>16;J[a+12>>1]=c;J[a+14>>1]=c>>>16;I[d+177904|0]=0;J[a>>1]=M[a>>1]|32768;c=a}a=M[l+2>>1]-j|0}d=1;J[((g<<1)+c|0)+2>>1]=a;K[f+8>>2]=c}g=g+1|0;if((g|0)!=6){continue}break}k=c}if((h|0)!=(i|0)){continue}break b}break}k=b}c=0;while(1){i=(m<<4)+216192|0;b=K[i>>2];if(b-5>>>0<2){break a}if((b|0)<=4){b=K[i+8>>2];a=M[i+4>>1];h:{if(!c){k=b;break h}if((b|0)!=(c|0)){break a}K[i+8>>2]=k}c=M[k>>1];if(c&16){break a}l=c&32?(Q(a,6)>>>0)/5|0:a;d=0;c=K[i+12>>2];b=c;g=0;while(1){a=g<<1;f=J[(a+c|0)+2>>1];j=a+k|0;a=J[j+2>>1];h=f-a|0;f=(Q(l,(Q(K[(g<<2)+200944>>2],(h|0)>0?f+(a<<1)|0:(f<<1)+a|0)|0)/3e3|0)|0)/256|0;i:{j:{if((h|0)>(f|0)){if(!d){if(J[c>>1]<0){b=c;a=a+f|0;break j}b=K[44469]+1|0;b=(b|0)<=169?b:0;K[44469]=b;d=M[c+20>>1]|M[c+22>>1]<<16;b=(b<<6)+177888|0;a=b+16|0;h=M[c+16>>1]|M[c+18>>1]<<16;J[a>>1]=h;J[a+2>>1]=h>>>16;J[a+4>>1]=d;J[a+6>>1]=d>>>16;a=M[c+4>>1]|M[c+6>>1]<<16;d=M[c>>1]|M[c+2>>1]<<16;J[b>>1]=d;J[b+2>>1]=d>>>16;J[b+4>>1]=a;J[b+6>>1]=a>>>16;a=M[c+12>>1]|M[c+14>>1]<<16;d=M[c+8>>1]|M[c+10>>1]<<16;J[b+8>>1]=d;J[b+10>>1]=d>>>16;J[b+12>>1]=a;J[b+14>>1]=a>>>16;a=M[c+28>>1]|M[c+30>>1]<<16;d=M[c+24>>1]|M[c+26>>1]<<16;J[b+24>>1]=d;J[b+26>>1]=d>>>16;J[b+28>>1]=a;J[b+30>>1]=a>>>16;a=M[c+36>>1]|M[c+38>>1]<<16;d=M[c+32>>1]|M[c+34>>1]<<16;J[b+32>>1]=d;J[b+34>>1]=d>>>16;J[b+36>>1]=a;J[b+38>>1]=a>>>16;a=M[c+44>>1]|M[c+46>>1]<<16;d=M[c+40>>1]|M[c+42>>1]<<16;J[b+40>>1]=d;J[b+42>>1]=d>>>16;J[b+44>>1]=a;J[b+46>>1]=a>>>16;a=M[c+52>>1]|M[c+54>>1]<<16;d=M[c+48>>1]|M[c+50>>1]<<16;J[b+48>>1]=d;J[b+50>>1]=d>>>16;J[b+52>>1]=a;J[b+54>>1]=a>>>16;a=M[c+60>>1]|M[c+62>>1]<<16;d=M[c+56>>1]|M[c+58>>1]<<16;J[b+56>>1]=d;J[b+58>>1]=d>>>16;J[b+60>>1]=a;J[b+62>>1]=a>>>16;I[b+16|0]=0;J[b>>1]=M[b>>1]|32768;a=M[j+2>>1]}a=a+f|0;break j}if((h|0)>=(0-f|0)){break i}k:{if(d){break k}if(J[c>>1]<0){b=c;break k}b=K[44469]+1|0;b=(b|0)<=169?b:0;K[44469]=b;d=M[c+20>>1]|M[c+22>>1]<<16;b=(b<<6)+177888|0;a=b+16|0;h=M[c+16>>1]|M[c+18>>1]<<16;J[a>>1]=h;J[a+2>>1]=h>>>16;J[a+4>>1]=d;J[a+6>>1]=d>>>16;a=M[c+4>>1]|M[c+6>>1]<<16;d=M[c>>1]|M[c+2>>1]<<16;J[b>>1]=d;J[b+2>>1]=d>>>16;J[b+4>>1]=a;J[b+6>>1]=a>>>16;a=M[c+12>>1]|M[c+14>>1]<<16;d=M[c+8>>1]|M[c+10>>1]<<16;J[b+8>>1]=d;J[b+10>>1]=d>>>16;J[b+12>>1]=a;J[b+14>>1]=a>>>16;a=M[c+28>>1]|M[c+30>>1]<<16;d=M[c+24>>1]|M[c+26>>1]<<16;J[b+24>>1]=d;J[b+26>>1]=d>>>16;J[b+28>>1]=a;J[b+30>>1]=a>>>16;a=M[c+36>>1]|M[c+38>>1]<<16;d=M[c+32>>1]|M[c+34>>1]<<16;J[b+32>>1]=d;J[b+34>>1]=d>>>16;J[b+36>>1]=a;J[b+38>>1]=a>>>16;a=M[c+44>>1]|M[c+46>>1]<<16;d=M[c+40>>1]|M[c+42>>1]<<16;J[b+40>>1]=d;J[b+42>>1]=d>>>16;J[b+44>>1]=a;J[b+46>>1]=a>>>16;a=M[c+52>>1]|M[c+54>>1]<<16;d=M[c+48>>1]|M[c+50>>1]<<16;J[b+48>>1]=d;J[b+50>>1]=d>>>16;J[b+52>>1]=a;J[b+54>>1]=a>>>16;a=M[c+60>>1]|M[c+62>>1]<<16;d=M[c+56>>1]|M[c+58>>1]<<16;J[b+56>>1]=d;J[b+58>>1]=d>>>16;J[b+60>>1]=a;J[b+62>>1]=a>>>16;I[b+16|0]=0;J[b>>1]=M[b>>1]|32768;a=M[j+2>>1]}a=a-f|0}d=1;J[((g<<1)+b|0)+2>>1]=a;K[i+12>>2]=b}g=g+1|0;if((g|0)!=6){continue}break}k=b}b=m+1|0;m=(b|0)<=169?b:0;if((n|0)!=(m|0)){continue}break}}K[36454]=n}}function ze(a,b){var c=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,y=0,A=0,D=0,E=0;n=sa-48|0;sa=n;C(+a);d=x(1)|0;c=x(0)|0;p=d;a:{b:{g=d&2147483647;c:{if(g>>>0<=1074752122){if((d&1048575)==598523){break c}if(g>>>0<=1073928572){if((p|0)>0|(p|0)>=0){a=a+-1.5707963267341256;f=a+-6077100506506192e-26;P[b>>3]=f;P[b+8>>3]=a-f+-6077100506506192e-26;d=1;break a}a=a+1.5707963267341256;f=a+6077100506506192e-26;P[b>>3]=f;P[b+8>>3]=a-f+6077100506506192e-26;d=-1;break a}if((p|0)>0|(p|0)>=0){a=a+-3.1415926534682512;f=a+-1.2154201013012384e-10;P[b>>3]=f;P[b+8>>3]=a-f+-1.2154201013012384e-10;d=2;break a}a=a+3.1415926534682512;f=a+1.2154201013012384e-10;P[b>>3]=f;P[b+8>>3]=a-f+1.2154201013012384e-10;d=-2;break a}if(g>>>0<=1075594811){if(g>>>0<=1075183036){if((g|0)==1074977148){break c}if((p|0)>0|(p|0)>=0){a=a+-4.712388980202377;f=a+-1.8231301519518578e-10;P[b>>3]=f;P[b+8>>3]=a-f+-1.8231301519518578e-10;d=3;break a}a=a+4.712388980202377;f=a+1.8231301519518578e-10;P[b>>3]=f;P[b+8>>3]=a-f+1.8231301519518578e-10;d=-3;break a}if((g|0)==1075388923){break c}if((p|0)>0|(p|0)>=0){a=a+-6.2831853069365025;f=a+-2.430840202602477e-10;P[b>>3]=f;P[b+8>>3]=a-f+-2.430840202602477e-10;d=4;break a}a=a+6.2831853069365025;f=a+2.430840202602477e-10;P[b>>3]=f;P[b+8>>3]=a-f+2.430840202602477e-10;d=-4;break a}if(g>>>0>1094263290){break b}}j=a*.6366197723675814+6755399441055744+-6755399441055744;f=a+j*-1.5707963267341256;l=j*6077100506506192e-26;u=f-l;c=u<-.7853981633974483;if(S(j)<2147483648){d=~~j}else{d=-2147483648}d:{if(c){d=d-1|0;j=j+-1;l=j*6077100506506192e-26;f=a+j*-1.5707963267341256;break d}if(!(u>.7853981633974483)){break d}d=d+1|0;j=j+1;l=j*6077100506506192e-26;f=a+j*-1.5707963267341256}a=f-l;P[b>>3]=a;C(+a);c=x(1)|0;x(0)|0;e=g>>>20|0;e:{if((e-(c>>>20&2047)|0)<17){break e}l=f;a=j*6077100506303966e-26;f=f-a;l=j*20222662487959506e-37-(l-f-a);a=f-l;P[b>>3]=a;C(+a);c=x(1)|0;x(0)|0;if((e-(c>>>20&2047)|0)<50){break e}l=f;a=j*20222662487111665e-37;f=f-a;l=j*84784276603689e-45-(l-f-a);a=f-l;P[b>>3]=a}P[b+8>>3]=f-a-l;break a}if(g>>>0>=2146435072){a=a-a;P[b>>3]=a;P[b+8>>3]=a;d=0;break a}z(0,c|0);z(1,p&1048575|1096810496);a=+B();d=0;c=1;while(1){e=(n+16|0)+(d<<3)|0;if(S(a)<2147483648){d=~~a}else{d=-2147483648}f=+(d|0);P[e>>3]=f;a=(a-f)*16777216;d=1;e=c;c=0;if(e){continue}break}P[n+32>>3]=a;d=2;while(1){c=d;d=c-1|0;if(P[(n+16|0)+(c<<3)>>3]==0){continue}break}v=n+16|0;e=0;h=sa-560|0;sa=h;d=(g>>>20|0)-1046|0;g=(d-3|0)/24|0;t=(g|0)>0?g:0;g=Q(t,-24)+d|0;m=K[28105];r=c+1|0;i=r-1|0;if((m+i|0)>=0){d=m+r|0;c=t-i|0;while(1){P[(h+320|0)+(e<<3)>>3]=(c|0)<0?0:+K[(c<<2)+112432>>2];c=c+1|0;e=e+1|0;if((d|0)!=(e|0)){continue}break}}q=g-24|0;d=0;e=(m|0)>0?m:0;o=(r|0)<=0;while(1){f:{if(o){a=0;break f}k=d+i|0;c=0;a=0;while(1){a=P[(c<<3)+v>>3]*P[(h+320|0)+(k-c<<3)>>3]+a;c=c+1|0;if((r|0)!=(c|0)){continue}break}}P[(d<<3)+h>>3]=a;c=(d|0)==(e|0);d=d+1|0;if(!c){continue}break}D=47-g|0;w=48-g|0;E=g-25|0;d=m;g:{while(1){a=P[(d<<3)+h>>3];c=0;e=d;k=(d|0)<=0;if(!k){while(1){o=(h+480|0)+(c<<2)|0;f=a*5.960464477539063e-8;h:{if(S(f)<2147483648){i=~~f;break h}i=-2147483648}f=+(i|0);a=f*-16777216+a;i:{if(S(a)<2147483648){i=~~a;break i}i=-2147483648}K[o>>2]=i;e=e-1|0;a=P[(e<<3)+h>>3]+f;c=c+1|0;if((d|0)!=(c|0)){continue}break}}a=Ib(a,q);a=a+W(a*.125)*-8;j:{if(S(a)<2147483648){o=~~a;break j}o=-2147483648}a=a-+(o|0);k:{l:{m:{y=(q|0)<=0;n:{if(!y){e=(d<<2)+h|0;i=K[e+476>>2];c=i>>w;s=e;e=i-(c<<w)|0;K[s+476>>2]=e;o=c+o|0;i=e>>D;break n}if(q){break m}i=K[((d<<2)+h|0)+476>>2]>>23}if((i|0)<=0){break k}break l}i=2;if(a>=.5){break l}i=0;break k}c=0;e=0;if(!k){while(1){s=(h+480|0)+(c<<2)|0;A=K[s>>2];k=16777215;o:{p:{if(e){break p}k=16777216;if(A){break p}e=0;break o}K[s>>2]=k-A;e=1}c=c+1|0;if((d|0)!=(c|0)){continue}break}}q:{if(y){break q}c=8388607;r:{switch(E|0){case 1:c=4194303;break;case 0:break r;default:break q}}k=(d<<2)+h|0;K[k+476>>2]=K[k+476>>2]&c}o=o+1|0;if((i|0)!=2){break k}a=1-a;i=2;if(!e){break k}a=a-Ib(1,q)}if(a==0){e=0;s:{c=d;if((m|0)>=(c|0)){break s}while(1){c=c-1|0;e=K[(h+480|0)+(c<<2)>>2]|e;if((c|0)>(m|0)){continue}break}if(!e){break s}g=q;while(1){g=g-24|0;d=d-1|0;if(!K[(h+480|0)+(d<<2)>>2]){continue}break}break g}c=1;while(1){e=c;c=c+1|0;if(!K[(h+480|0)+(m-e<<2)>>2]){continue}break}e=d+e|0;while(1){i=d+r|0;d=d+1|0;P[(h+320|0)+(i<<3)>>3]=K[(t+d<<2)+112432>>2];c=0;a=0;if((r|0)>0){while(1){a=P[(c<<3)+v>>3]*P[(h+320|0)+(i-c<<3)>>3]+a;c=c+1|0;if((r|0)!=(c|0)){continue}break}}P[(d<<3)+h>>3]=a;if((d|0)<(e|0)){continue}break}d=e;continue}break}a=Ib(a,24-g|0);t:{if(a>=16777216){q=(h+480|0)+(d<<2)|0;f=a*5.960464477539063e-8;u:{if(S(f)<2147483648){c=~~f;break u}c=-2147483648}a=+(c|0)*-16777216+a;v:{if(S(a)<2147483648){e=~~a;break v}e=-2147483648}K[q>>2]=e;d=d+1|0;break t}if(S(a)<2147483648){c=~~a}else{c=-2147483648}g=q}K[(h+480|0)+(d<<2)>>2]=c}a=Ib(1,g);w:{if((d|0)<0){break w}c=d;while(1){e=c;P[(c<<3)+h>>3]=a*+K[(h+480|0)+(c<<2)>>2];c=c-1|0;a=a*5.960464477539063e-8;if(e){continue}break}k=0;if((d|0)<0){break w}g=(m|0)>0?m:0;e=d;while(1){q=g>>>0<k>>>0?g:k;m=d-e|0;c=0;a=0;while(1){a=P[(c<<3)+115200>>3]*P[(c+e<<3)+h>>3]+a;r=(c|0)!=(q|0);c=c+1|0;if(r){continue}break}P[(h+160|0)+(m<<3)>>3]=a;e=e-1|0;c=(d|0)!=(k|0);k=k+1|0;if(c){continue}break}}a=0;if((d|0)>=0){c=d;while(1){e=c;c=c-1|0;a=a+P[(h+160|0)+(e<<3)>>3];if(e){continue}break}}P[n>>3]=i?-a:a;a=P[h+160>>3]-a;c=1;if((d|0)>0){while(1){a=a+P[(h+160|0)+(c<<3)>>3];e=(c|0)!=(d|0);c=c+1|0;if(e){continue}break}}P[n+8>>3]=i?-a:a;sa=h+560|0;d=o&7;a=P[n>>3];if((p|0)<0){P[b>>3]=-a;P[b+8>>3]=-P[n+8>>3];d=0-d|0;break a}P[b>>3]=a;P[b+8>>3]=P[n+8>>3]}sa=n+48|0;return d}function Sf(a,b,c,d,e,f){a=a|0;b=+b;c=c|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,y=0,z=0;m=sa-560|0;sa=m;K[m+44>>2]=0;C(+b);g=x(1)|0;x(0)|0;a:{if((g|0)<0){s=1;y=84997;b=-b;C(+b);g=x(1)|0;x(0)|0;break a}if(e&2048){s=1;y=85e3;break a}s=e&1;y=s?85003:84998;z=!s}b:{if((g&2146435072)==2146435072){g=s+3|0;Ya(a,32,c,g,e&-65537);Va(a,y,s);d=f&32;Va(a,b!=b?d?85596:85774:d?85247:85460,3);Ya(a,32,c,g,e^8192);n=(c|0)<(g|0)?g:c;break b}u=m+16|0;c:{d:{e:{b=je(b,m+44|0);b=b+b;if(b!=0){g=K[m+44>>2];K[m+44>>2]=g-1;v=f|32;if((v|0)!=97){break e}break c}v=f|32;if((v|0)==97){break c}k=K[m+44>>2];l=(d|0)<0?6:d;break d}k=g-29|0;K[m+44>>2]=k;b=b*268435456;l=(d|0)<0?6:d}q=(m+48|0)+((k|0)>=0?288:0)|0;h=q;while(1){if(b<4294967296&b>=0){d=~~b>>>0}else{d=0}K[h>>2]=d;h=h+4|0;b=(b-+(d>>>0))*1e9;if(b!=0){continue}break}f:{if((k|0)<=0){d=k;g=h;i=q;break f}i=q;d=k;while(1){o=(d|0)>=29?29:d;g=h-4|0;g:{if(i>>>0>g>>>0){break g}d=0;while(1){j=K[g>>2];w=d;d=o&31;if((o&63)>>>0>=32){n=j<<d;d=0}else{n=(1<<d)-1&j>>>32-d;d=j<<d}w=w+d|0;j=n+p|0;d=wg(w,d>>>0>w>>>0?j+1|0:j,1e9);K[g>>2]=w-vg(d,va,1e9,0);g=g-4|0;if(i>>>0<=g>>>0){continue}break}if(!d){break g}i=i-4|0;K[i>>2]=d}while(1){g=h;if(i>>>0<g>>>0){h=g-4|0;if(!K[h>>2]){continue}}break}d=K[m+44>>2]-o|0;K[m+44>>2]=d;h=g;if((d|0)>0){continue}break}}if((d|0)<0){t=((l+25>>>0)/9|0)+1|0;p=(v|0)==102;while(1){d=0-d|0;n=(d|0)>=9?9:d;h:{if(g>>>0<=i>>>0){h=K[i>>2];break h}o=1e9>>>n|0;j=-1<<n^-1;d=0;h=i;while(1){w=d;d=K[h>>2];K[h>>2]=w+(d>>>n|0);d=Q(o,d&j);h=h+4|0;if(h>>>0<g>>>0){continue}break}h=K[i>>2];if(!d){break h}K[g>>2]=d;g=g+4|0}d=n+K[m+44>>2]|0;K[m+44>>2]=d;i=(!h<<2)+i|0;h=p?q:i;g=g-h>>2>(t|0)?h+(t<<2)|0:g;if((d|0)<0){continue}break}}d=0;i:{if(g>>>0<=i>>>0){break i}d=Q(q-i>>2,9);h=10;j=K[i>>2];if(j>>>0<10){break i}while(1){d=d+1|0;h=Q(h,10);if(j>>>0>=h>>>0){continue}break}}h=(l-((v|0)!=102?d:0)|0)-((v|0)==103&(l|0)!=0)|0;if((h|0)<(Q(g-q>>2,9)-9|0)){o=h+9216|0;j=(o|0)/9|0;k=((((k|0)<0?4:292)+m|0)+(j<<2)|0)-4048|0;h=10;n=o-Q(j,9)|0;if((n|0)<=7){while(1){h=Q(h,10);n=n+1|0;if((n|0)!=8){continue}break}}o=K[k>>2];t=(o>>>0)/(h>>>0)|0;p=o-Q(h,t)|0;j=k+4|0;j:{if(!p&(j|0)==(g|0)){break j}k:{if(!(t&1)){b=9007199254740992;if(!(I[k-4|0]&1)|((h|0)!=1e9|i>>>0>=k>>>0)){break k}}b=9007199254740994}r=(g|0)==(j|0)?1:1.5;j=h>>>1|0;r=j>>>0>p>>>0?.5:(j|0)==(p|0)?r:1.5;if(!(L[y|0]!=45|z)){r=-r;b=-b}j=o-p|0;K[k>>2]=j;if(b+r==b){break j}d=h+j|0;K[k>>2]=d;if(d>>>0>=1e9){while(1){K[k>>2]=0;k=k-4|0;if(k>>>0<i>>>0){i=i-4|0;K[i>>2]=0}d=K[k>>2]+1|0;K[k>>2]=d;if(d>>>0>999999999){continue}break}}d=Q(q-i>>2,9);h=10;j=K[i>>2];if(j>>>0<10){break j}while(1){d=d+1|0;h=Q(h,10);if(j>>>0>=h>>>0){continue}break}}h=k+4|0;g=g>>>0>h>>>0?h:g}while(1){j=g;o=g>>>0<=i>>>0;if(!o){g=j-4|0;if(!K[g>>2]){continue}}break}l:{if((v|0)!=103){k=e&8;break l}h=l?l:1;g=(h|0)>(d|0)&(d|0)>-5;l=(g?d^-1:-1)+h|0;f=(g?-1:-2)+f|0;k=e&8;if(k){break l}g=-9;m:{if(o){break m}k=K[j-4>>2];if(!k){break m}n=10;g=0;if((k>>>0)%10|0){break m}while(1){h=g;g=g+1|0;n=Q(n,10);if(!((k>>>0)%(n>>>0)|0)){continue}break}g=h^-1}h=Q(j-q>>2,9);if((f&-33)==70){k=0;g=(g+h|0)-9|0;g=(g|0)>0?g:0;l=(g|0)>(l|0)?l:g;break l}k=0;g=((d+h|0)+g|0)-9|0;g=(g|0)>0?g:0;l=(g|0)>(l|0)?l:g}n=-1;o=k|l;if(((o?2147483645:2147483646)|0)<(l|0)){break b}p=(((o|0)!=0)+l|0)+1|0;h=f&-33;n:{if((h|0)==70){if((p^2147483647)<(d|0)){break b}g=(d|0)>0?d:0;break n}g=d>>31;g=Vb((g^d)-g|0,0,u);if((u-g|0)<=1){while(1){g=g-1|0;I[g|0]=48;if((u-g|0)<2){continue}break}}t=g-2|0;I[t|0]=f;I[g-1|0]=(d|0)<0?45:43;g=u-t|0;if((g|0)>(p^2147483647)){break b}}d=g+p|0;if((d|0)>(s^2147483647)){break b}p=d+s|0;Ya(a,32,c,p,e);Va(a,y,s);Ya(a,48,c,p,e^65536);o:{p:{q:{if((h|0)==70){f=m+16|0;d=f|8;k=f|9;h=i>>>0>q>>>0?q:i;i=h;while(1){g=Vb(K[i>>2],0,k);r:{if((h|0)!=(i|0)){if(m+16>>>0>=g>>>0){break r}while(1){g=g-1|0;I[g|0]=48;if(m+16>>>0<g>>>0){continue}break}break r}if((g|0)!=(k|0)){break r}I[m+24|0]=48;g=d}Va(a,g,k-g|0);i=i+4|0;if(q>>>0>=i>>>0){continue}break}if(o){Va(a,85998,1)}if((l|0)<=0|i>>>0>=j>>>0){break q}while(1){g=Vb(K[i>>2],0,k);if(g>>>0>m+16>>>0){while(1){g=g-1|0;I[g|0]=48;if(m+16>>>0<g>>>0){continue}break}}Va(a,g,(l|0)>=9?9:l);g=l-9|0;i=i+4|0;if(j>>>0<=i>>>0){break p}d=(l|0)>9;l=g;if(d){continue}break}break p}s:{if((l|0)<0){break s}q=i>>>0<j>>>0?j:i+4|0;f=m+16|0;d=f|8;j=f|9;h=i;while(1){g=Vb(K[h>>2],0,j);if((j|0)==(g|0)){I[m+24|0]=48;g=d}t:{if((h|0)!=(i|0)){if(m+16>>>0>=g>>>0){break t}while(1){g=g-1|0;I[g|0]=48;if(m+16>>>0<g>>>0){continue}break}break t}Va(a,g,1);g=g+1|0;if(!(k|l)){break t}Va(a,85998,1)}f=j-g|0;Va(a,g,(f|0)>(l|0)?l:f);l=l-f|0;h=h+4|0;if(q>>>0<=h>>>0){break s}if((l|0)>=0){continue}break}}Ya(a,48,l+18|0,18,0);Va(a,t,u-t|0);break o}g=l}Ya(a,48,g+9|0,9,0)}Ya(a,32,c,p,e^8192);n=(c|0)<(p|0)?p:c;break b}k=(f<<26>>31&9)+y|0;u:{if(d>>>0>11){break u}g=12-d|0;r=16;while(1){r=r*16;g=g-1|0;if(g){continue}break}if(L[k|0]==45){b=-(r+(-b-r));break u}b=b+r-r}g=K[m+44>>2];h=g>>31;g=Vb((g^h)-h|0,0,u);if((u|0)==(g|0)){I[m+15|0]=48;g=m+15|0}q=s|2;i=f&32;h=K[m+44>>2];l=g-2|0;I[l|0]=f+15;I[g-1|0]=(h|0)<0?45:43;g=e&8;h=m+16|0;while(1){f=h;if(S(b)<2147483648){j=~~b}else{j=-2147483648}I[h|0]=i|L[j+124512|0];b=(b-+(j|0))*16;h=f+1|0;if(!(!((d|0)>0|g)&b==0|(h-(m+16|0)|0)!=1)){I[f+1|0]=46;h=f+2|0}if(b!=0){continue}break}n=-1;g=u-l|0;f=g+q|0;if((2147483645-f|0)<(d|0)){break b}v:{w:{if(!d){break w}i=h-(m+16|0)|0;if((i-2|0)>=(d|0)){break w}d=d+2|0;break v}i=h-(m+16|0)|0;d=i}f=d+f|0;Ya(a,32,c,f,e);Va(a,k,q);Ya(a,48,c,f,e^65536);Va(a,m+16|0,i);Ya(a,48,d-i|0,0,0);Va(a,l,g);Ya(a,32,c,f,e^8192);n=(c|0)<(f|0)?f:c}sa=m+560|0;return n|0}function He(){var a=0,b=0,c=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,M=0,O=0,R=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0;K[55925]=0;a=K[56772];K[56772]=a+1;c=K[55961];m=K[55922];b=+(a|0);o=pc(b*39.89822670059037);j=pc(b*22.30530784048753);b=+(m|0)/50*(+(c|0)/100)*(pc(b*14.765485471872028)+(o+j))*10;a:{if(S(b)<2147483648){a=~~b;break a}a=-2147483648}K[56607]=a+K[56607];b:{if(K[55923]<=0){break b}while(1){c=vg(K[33209],0,1103515245,0);a=va;c=c+12345|0;a=c>>>0<12345?a+1|0:a;a=xg(c,a);K[33209]=a;a=((a>>>0)%16383|0)+8191|0;K[55929]=a;D=+(a|0);b=P[28387]*.75+D;P[28387]=b;a=K[55924];w=K[55928];E=(a|0)>(w|0)?b*.5:b;e=+K[56652]*.033;M=e>0?1-e:1;c=K[56650]<<2;y=K[55921];z=(y|0)==1?(c|0)>263?263:c:c;F=K[56651];O=(F<<1)+111136|0;A=K[56658];R=(A<<1)+111136|0;T=(A|0)>0;G=K[55918];U=Q(G,40);V=K[55925];W=P[27967];H=K[56607];b=P[27979];q=P[27969];h=P[27970];B=K[56780];t=K[56654];l=P[27976];n=P[27972];r=P[28388];s=P[28389];m=K[55927];d=P[28383];k=K[55926];u=K[55956];X=P[27975];j=P[28131];f=P[28130];g=P[28123];p=P[28121];i=P[28122];x=P[28120];v=P[28119];Y=P[28129];Z=P[28128];_=P[28127];$=hb(P[27968]*0);C=0;while(1){o=f;c:{d:{switch(y-1|0){case 0:r=0;f=p*g;g=i;r=(a|0)<=2?P[(a<<3)+111312>>3]:r;d=f+(v*r+x*g);i=d;break c;case 1:d=0;if((a|0)>=(m|0)){s=0;break c}f=P[27965]-P[27966];P[27965]=f;s=f+s;d=s*.028;break c;case 2:if(!k){u=100;d=0;break c}u=100;f=+(a|0)/+(k|0)*100;e:{if(S(f)<2147483648){c=~~f;break e}c=-2147483648}d=+J[((c|0)%100<<1)+110928>>1];d=b*((+J[((c+1|0)%100<<1)+110928>>1]-d)*(f-+(c|0))+d);break c;case 3:break d;default:break c}}if(!k){u=256;d=0;break c}u=256;f=+(a|0)/+(k|0)*256;f:{if(S(f)<2147483648){c=~~f;break f}c=-2147483648}d=+J[((c|0)%256<<1)+111344>>1];d=b*((+J[((c+1|0)%256<<1)+111344>>1]-d)*(f-+(c|0))+d)}if((a|0)>=(k|0)){g:{if((H|0)>0){a=(U|0)/(H|0)|0;l=0;n=0;n=A>>>0<=87?+J[R>>1]*.001:n;l=F>>>0<=87?+J[O>>1]*.001*.1:l;w=a>>T;k=(a-1|0)<=(z|0);c=k?a-2|0:z;m=(c|0)<=40?40:c;m=k?m:(c|0)<40?m:z;f=+J[(m<<1)+111776>>1];P[27966]=f;p=f;f=+(m|0);P[27965]=p*f*.333;c=a-m|0;t=(c|0)>(t|0)?t:c;c=(B|0)<0?0-t|0:t;B=0-c|0;f=f*.00833;v=f*f;f=nb(W*+((G|0)/(m|0)|0));p=f*$;x=p+p;p=f*-f;v=v*(1-x-p);k=a+c|0;a=(k|0)!=4;break g}K[55930]=0;K[55931]=0;K[55932]=0;K[55933]=0;w=4;l=0;n=0;k=4;a=0}a=a|!V;h=a?e:h;q=a?M:q;a=0}a=a+1|0;d=Y*j+(_*d+Z*o);f=d;j=o;C=C+1|0;if((C|0)!=4){continue}break}K[55926]=k;K[55956]=u;K[55924]=a;P[28383]=d;K[55927]=m;P[28389]=s;P[28388]=r;P[27972]=n;P[27976]=l;K[55928]=w;K[56654]=t;K[56780]=B;P[27970]=h;P[27969]=q;P[28122]=i;P[28120]=x;P[28119]=v;P[28123]=g;P[28121]=p;P[28131]=j;P[28130]=d;if((y|0)==5){b=+(a|0)/+(k|0);d=(b+b+-1)*6e3;P[28383]=d}b=d*q+P[28384]*h;P[28383]=b;P[28384]=b;if((a|0)<(m|0)){b=l*D+b;P[28383]=b}h=E*P[27974];o=b*P[27973]+h;j=0;if(K[55916]!=2){j=P[27987];i=P[27986];P[27987]=i;b=h+b*n;P[27986]=b;h=P[28059];g=P[28058];P[28059]=g;b=h*P[28057]+(P[28055]*(j*P[27985]+(P[27983]*b+i*P[27984]))+g*P[28056]);P[28058]=b;j=P[28049];h=P[28051];i=P[28048];g=P[28047];e=P[28050];P[28051]=e;b=j*h+(g*b+i*e);P[28050]=b;j=P[28043];h=P[28041];i=P[28040];g=P[28039];e=P[28042];P[28043]=e;b=h*j+(g*b+i*e);P[28042]=b;j=P[28035];h=P[28033];i=P[28032];g=P[28031];e=P[28034];P[28035]=e;b=h*j+(g*b+i*e);P[28034]=b;j=P[28027];h=P[28025];i=P[28024];g=P[28023];e=P[28026];P[28027]=e;b=h*j+(g*b+i*e);P[28026]=b;j=P[28019];h=P[28017];i=P[28016];g=P[28015];e=P[28018];P[28019]=e;b=h*j+(g*b+i*e);P[28018]=b;j=P[28011];h=P[28009];i=P[28008];g=P[28007];e=P[28010];P[28011]=e;b=h*j+(g*b+i*e);P[28010]=b;j=P[28003];h=P[28001];i=P[28e3];g=P[27999];e=P[28002];P[28003]=e;b=h*j+(g*b+i*e);P[28002]=b;j=P[27995];h=P[27993];i=P[27992];g=P[27991];e=P[27994];P[27995]=e;j=h*j+(g*b+i*e);P[27994]=j}b=P[28385];P[28385]=o;h=P[28075];i=P[28074];P[28075]=i;g=P[28067];e=P[28066];P[28067]=e;h=h*P[28073]+(P[28071]*o+i*P[28072]);P[28074]=h;i=g*P[28065]+(P[28063]*o+e*P[28064]);P[28066]=i;g=P[28081];e=P[28083];f=P[28079];d=P[28080];l=P[28082];P[28083]=l;b=X*E+o-b;o=g*e+(f*b+d*l);P[28082]=o;g=P[28091];e=P[28089];f=P[28087];d=P[28088];l=P[28090];P[28091]=l;g=e*g+(f*b+d*l);P[28090]=g;e=P[28099];f=P[28097];d=P[28095];l=P[28096];n=P[28098];P[28099]=n;e=f*e+(d*b+l*n);P[28098]=e;f=P[28107];d=P[28105];l=P[28103];n=P[28104];q=P[28106];P[28107]=q;f=d*f+(l*b+n*q);P[28106]=f;d=P[28115];l=P[28113];n=P[28111];q=P[28112];r=P[28114];P[28115]=r;d=l*d+(n*b+q*r);P[28114]=d;l=P[28139];n=P[28137];q=P[28136];r=P[28135];s=P[27971];p=P[28138];P[28139]=p;b=n*l+(r*(b*s-(d-(f-(e-(g-(o-(j+h+i)))))))+q*p);P[28138]=b;b=P[27977]*(b*+K[50779]);h:{if(S(b)<2147483648){a=~~b;break h}a=-2147483648}d=+(a|0);a=K[50776];if((a|0)<K[50773]){k=a+1|0;c=K[50772];m=K[50774];i:{if(!m){m=L[a+c|0];c=I[c+k|0];K[50776]=a+2;a=m|c<<8;break i}K[50776]=k;a=Q(m,I[a+c|0])}d=d+ +((Q(K[50775],(Q(a,K[50780])|0)/1024|0)|0)/40|0)}a=K[55962];if((a|0)<=63){K[55962]=a+1;d=d*+(a|0)*.015625}a=K[55963];j:{if((a|0)<=0){break j}a=a-1|0;K[55963]=a;d=d*+(a|0)*.015625;if(a){break j}K[55962]=0}a=K[51293];c=a+1|0;K[51293]=c;k=Q(J[(a<<1)+205184>>1],K[50755])>>8;if(S(d)<2147483648){a=~~d}else{a=-2147483648}if((c|0)>=5500){K[51293]=0}c=K[51290];K[51290]=c+1;a=a+k|0;a=(a|0)<=-32768?-32768:a;a=(a|0)>=32767?32767:a;I[c|0]=a;c=K[51290];K[51290]=c+1;I[c|0]=a>>>8;c=K[51292];k=c+1|0;K[51292]=k;J[(c<<1)+205184>>1]=a;if((k|0)>=5500){K[51292]=0}k=1;K[56606]=K[56606]+1;if(N[54046]<K[51290]+2>>>0){break b}a=K[55925]+1|0;K[55925]=a;if((a|0)<K[55923]){continue}break}k=0}return k}function he(a,b,c,d,e,f,g){var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0;j=sa-80|0;sa=j;K[j+76>>2]=b;y=j+55|0;s=j+56|0;a:{b:{c:{d:{e:while(1){k=b;if((p^2147483647)<(h|0)){break d}p=h+p|0;f:{g:{h:{h=k;i=L[h|0];if(i){while(1){i:{b=i&255;j:{if(!b){b=h;break j}if((b|0)!=37){break i}i=h;while(1){if(L[i+1|0]!=37){b=i;break j}h=h+1|0;m=L[i+2|0];b=i+2|0;i=b;if((m|0)==37){continue}break}}h=h-k|0;x=p^2147483647;if((h|0)>(x|0)){break d}if(a){Va(a,k,h)}if(h){continue e}K[j+76>>2]=b;h=b+1|0;q=-1;if(!(L[b+2|0]!=36|I[b+1|0]-48>>>0>=10)){q=I[b+1|0]-48|0;u=1;h=b+3|0}K[j+76>>2]=h;n=0;i=I[h|0];b=i-32|0;k:{if(b>>>0>31){o=h;break k}o=h;b=1<<b;if(!(b&75913)){break k}while(1){o=h+1|0;K[j+76>>2]=o;n=b|n;i=I[h+1|0];b=i-32|0;if(b>>>0>=32){break k}h=o;b=1<<b;if(b&75913){continue}break}}l:{if((i|0)==42){m:{if(!(L[o+2|0]!=36|I[o+1|0]-48>>>0>=10)){K[((I[o+1|0]<<2)+e|0)-192>>2]=10;i=o+3|0;u=1;b=K[((I[o+1|0]<<3)+d|0)-384>>2];break m}if(u){break h}i=o+1|0;if(!a){K[j+76>>2]=i;u=0;r=0;break l}b=K[c>>2];K[c>>2]=b+4;u=0;b=K[b>>2]}K[j+76>>2]=i;r=b;if((b|0)>=0){break l}r=0-r|0;n=n|8192;break l}r=ge(j+76|0);if((r|0)<0){break d}i=K[j+76>>2]}h=0;l=-1;n:{if(L[i|0]!=46){b=i;w=0;break n}if(L[i+1|0]==42){o:{if(!(L[i+3|0]!=36|I[i+2|0]-48>>>0>=10)){K[((I[i+2|0]<<2)+e|0)-192>>2]=10;b=i+4|0;l=K[((I[i+2|0]<<3)+d|0)-384>>2];break o}if(u){break h}b=i+2|0;l=0;if(!a){break o}i=K[c>>2];K[c>>2]=i+4;l=K[i>>2]}K[j+76>>2]=b;w=(l^-1)>>>31|0;break n}K[j+76>>2]=i+1;l=ge(j+76|0);b=K[j+76>>2];w=1}while(1){t=h;o=28;m=b;h=I[b|0];if(h-123>>>0<4294967238){break c}b=m+1|0;h=L[(h+Q(t,58)|0)+123983|0];if(h-1>>>0<8){continue}break}K[j+76>>2]=b;p:{q:{if((h|0)!=27){if(!h){break c}if((q|0)>=0){K[(q<<2)+e>>2]=h;i=(q<<3)+d|0;h=K[i+4>>2];K[j+64>>2]=K[i>>2];K[j+68>>2]=h;break q}if(!a){break f}fe(j- -64|0,h,c,g);break p}if((q|0)>=0){break c}}h=0;if(!a){continue e}}i=n&-65537;n=n&8192?i:n;q=0;v=84065;o=s;r:{s:{t:{u:{v:{w:{x:{y:{z:{A:{B:{C:{D:{E:{F:{G:{h=I[m|0];h=t?(h&15)==3?h&-33:h:h;switch(h-88|0){case 11:break r;case 9:case 13:case 14:case 15:break s;case 27:break x;case 12:case 17:break A;case 23:break B;case 0:case 32:break C;case 24:break D;case 22:break E;case 29:break F;case 1:case 2:case 3:case 4:case 5:case 6:case 7:case 8:case 10:case 16:case 18:case 19:case 20:case 21:case 25:case 26:case 28:case 30:case 31:break g;default:break G}}H:{switch(h-65|0){case 0:case 4:case 5:case 6:break s;case 2:break v;case 1:case 3:break g;default:break H}}if((h|0)==83){break w}break g}i=K[j+64>>2];m=K[j+68>>2];v=84065;break z}h=0;I:{switch(t&255){case 0:K[K[j+64>>2]>>2]=p;continue e;case 1:K[K[j+64>>2]>>2]=p;continue e;case 2:k=K[j+64>>2];K[k>>2]=p;K[k+4>>2]=p>>31;continue e;case 3:J[K[j+64>>2]>>1]=p;continue e;case 4:I[K[j+64>>2]]=p;continue e;case 6:K[K[j+64>>2]>>2]=p;continue e;case 7:break I;default:continue e}}k=K[j+64>>2];K[k>>2]=p;K[k+4>>2]=p>>31;continue e}l=l>>>0<=8?8:l;n=n|8;h=120}k=s;z=h&32;i=K[j+64>>2];m=K[j+68>>2];if(i|m){while(1){k=k-1|0;I[k|0]=z|L[(i&15)+124512|0];A=!m&i>>>0>15|(m|0)!=0;t=m;m=m>>>4|0;i=(t&15)<<28|i>>>4;if(A){continue}break}}if(!(K[j+64>>2]|K[j+68>>2])|!(n&8)){break y}v=(h>>>4|0)+84065|0;q=2;break y}h=s;k=K[j+68>>2];m=k;i=K[j+64>>2];if(k|i){while(1){h=h-1|0;I[h|0]=i&7|48;t=!m&i>>>0>7|(m|0)!=0;k=m;m=k>>>3|0;i=(k&7)<<29|i>>>3;if(t){continue}break}}k=h;if(!(n&8)){break y}h=s-k|0;l=(h|0)<(l|0)?l:h+1|0;break y}i=K[j+64>>2];h=K[j+68>>2];m=h;if((h|0)<0){k=0-(m+((i|0)!=0)|0)|0;m=k;i=0-i|0;K[j+64>>2]=i;K[j+68>>2]=k;q=1;v=84065;break z}if(n&2048){q=1;v=84066;break z}q=n&1;v=q?84067:84065}k=Vb(i,m,s)}if((l|0)<0?w:0){break d}n=w?n&-65537:n;h=K[j+64>>2];i=K[j+68>>2];if(!(l|(h|i)!=0)){k=s;l=0;break g}h=!(h|i)+(s-k|0)|0;l=(h|0)<(l|0)?l:h;break g}h=K[j+64>>2];k=h?h:84639;m=l>>>0>=2147483647?2147483647:l;h=Wb(k,0,m);h=h?h-k|0:m;o=h+k|0;if((l|0)>=0){n=i;l=h;break g}n=i;l=h;if(L[o|0]){break d}break g}if(l){i=K[j+64>>2];break u}h=0;Ya(a,32,r,0,n);break t}K[j+12>>2]=0;K[j+8>>2]=K[j+64>>2];i=j+8|0;K[j+64>>2]=i;l=-1}h=0;J:{while(1){k=K[i>>2];if(!k){break J}m=Yd(j+4|0,k);k=(m|0)<0;if(!(k|m>>>0>l-h>>>0)){i=i+4|0;h=h+m|0;if(l>>>0>h>>>0){continue}break J}break}if(k){break b}}o=61;if((h|0)<0){break c}Ya(a,32,r,h,n);if(!h){h=0;break t}o=0;i=K[j+64>>2];while(1){k=K[i>>2];if(!k){break t}k=Yd(j+4|0,k);o=k+o|0;if(o>>>0>h>>>0){break t}Va(a,j+4|0,k);i=i+4|0;if(h>>>0>o>>>0){continue}break}}Ya(a,32,r,h,n^8192);h=(h|0)<(r|0)?r:h;continue e}if((l|0)<0?w:0){break d}o=61;h=wa[f|0](a,P[j+64>>3],r,l,n,h)|0;if((h|0)>=0){continue e}break c}I[j+55|0]=K[j+64>>2];l=1;k=y;n=i;break g}i=L[h+1|0];h=h+1|0;continue}}if(a){break a}if(!u){break f}h=1;while(1){a=K[(h<<2)+e>>2];if(a){fe((h<<3)+d|0,a,c,g);p=1;h=h+1|0;if((h|0)!=10){continue}break a}break}p=1;if(h>>>0>=10){break a}while(1){if(K[(h<<2)+e>>2]){break h}h=h+1|0;if((h|0)!=10){continue}break}break a}o=28;break c}m=o-k|0;i=(l|0)>(m|0)?l:m;if((i|0)>(q^2147483647)){break d}o=61;l=i+q|0;h=(l|0)<(r|0)?r:l;if((x|0)<(h|0)){break c}Ya(a,32,h,l,n);Va(a,v,q);Ya(a,48,h,l,n^65536);Ya(a,48,i,m,0);Va(a,k,m);Ya(a,32,h,l,n^8192);continue}break}p=0;break a}o=61}K[56798]=o}p=-1}sa=j+80|0;return p}function Ja(a,b,c,d,e,f,g,h,i){var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0;k=sa-96|0;sa=k;u=i&65535;o=(e^i)&-2147483648;q=e&65535;z=q;Q=i>>>16&32767;R=e>>>16&32767;a:{b:{if(Q-32767>>>0>4294934529&R-32767>>>0>=4294934530){break b}s=e&2147483647;r=s;j=d;if(!(!d&(r|0)==2147418112?!(b|c):r>>>0<2147418112)){m=d;o=e|32768;break a}s=i&2147483647;p=s;e=h;if(!(!e&(p|0)==2147418112?!(f|g):p>>>0<2147418112)){m=h;o=i|32768;b=f;c=g;break a}if(!(b|j|(r^2147418112|c))){if(!(e|f|(g|p))){o=2147450880;b=0;c=0;break a}o=o|2147418112;b=0;c=0;break a}if(!(e|f|(p^2147418112|g))){e=b|j;d=c|r;b=0;c=0;if(!(d|e)){o=2147450880;break a}o=o|2147418112;break a}if(!(b|j|(c|r))){b=0;c=0;break a}if(!(e|f|(g|p))){b=0;c=0;break a}if((r|0)==65535|r>>>0<65535){j=!(d|q);i=j?b:d;s=j<<6;e=T(i)+32|0;i=T(j?c:q);i=s+((i|0)==32?e:i)|0;Xa(k+80|0,b,c,d,q,i-15|0);t=16-i|0;d=K[k+88>>2];z=K[k+92>>2];c=K[k+84>>2];b=K[k+80>>2]}if(p>>>0>65535){break b}i=!(h|u);e=i?f:h;q=i<<6;j=T(e)+32|0;e=T(i?g:u);e=q+((e|0)==32?j:e)|0;Xa(k- -64|0,f,g,h,u,e-15|0);t=(t-e|0)+16|0;h=K[k+72>>2];u=K[k+76>>2];f=K[k+64>>2];g=K[k+68>>2]}e=f;f=g<<15|f>>>17;i=e<<15;e=0;v=i&-32768;J=c;s=vg(v,e,c,0);e=va;y=e;L=f;r=b;b=vg(f,0,b,0);i=b+s|0;f=va+e|0;c=b>>>0>i>>>0?f+1|0:f;j=0;b=vg(r,l,v,l);p=j+b|0;f=i;e=f+va|0;e=b>>>0>p>>>0?e+1|0:e;q=e;M=(f|0)==(e|0)&j>>>0>p>>>0|e>>>0<f>>>0;N=d;w=vg(v,l,d,0);O=va;b=vg(J,l,L,l);x=b+w|0;j=va+O|0;j=b>>>0>x>>>0?j+1|0:j;b=u<<15|h>>>17;A=h<<15|g>>>17;d=vg(A,0,r,l);B=d+x|0;f=va+j|0;f=d>>>0>B>>>0?f+1|0:f;C=f;d=(c|0)==(y|0)&i>>>0<s>>>0|c>>>0<y>>>0;D=c+B|0;f=d+f|0;f=c>>>0>D>>>0?f+1|0:f;u=f;g=D;c=f;E=z|65536;z=vg(v,l,E,n);P=va;d=vg(N,m,L,l);F=d+z|0;e=va+P|0;e=d>>>0>F>>>0?e+1|0:e;i=e;G=b|-2147483648;b=vg(G,0,r,l);H=b+F|0;f=va+e|0;f=b>>>0>H>>>0?f+1|0:f;b=vg(A,m,J,l);y=b+H|0;I=f;f=f+va|0;s=b>>>0>y>>>0?f+1|0:f;b=0;r=b+g|0;e=c+y|0;v=b>>>0>r>>>0?e+1|0:e;f=v;b=r+M|0;c=b>>>0<r>>>0?f+1|0:f;t=((R+Q|0)+t|0)-16383|0;d=vg(G,m,J,l);h=va;e=vg(E,m,L,l);g=e+d|0;f=va+h|0;f=e>>>0>g>>>0?f+1|0:f;n=(h|0)==(f|0)&d>>>0>g>>>0|f>>>0<h>>>0;h=f;e=vg(A,m,N,m);d=e+g|0;f=va+f|0;f=d>>>0<e>>>0?f+1|0:f;e=f;g=(f|0)==(h|0)&d>>>0<g>>>0|f>>>0<h>>>0;f=0;h=g;g=g+n|0;f=h>>>0>g>>>0?1:f;h=g;g=vg(G,m,E,m);h=h+g|0;f=va+f|0;M=h;g=g>>>0>h>>>0?f+1|0:f;h=d;l=e;e=(j|0)==(O|0)&w>>>0>x>>>0|j>>>0<O>>>0;f=0;j=(j|0)==(C|0)&x>>>0>B>>>0|j>>>0>C>>>0;n=j;j=e+j|0;e=(n>>>0>j>>>0?1:f)+l|0;f=g;d=d+j|0;e=d>>>0<j>>>0?e+1|0:e;n=e;w=d;d=(e|0)==(l|0)&d>>>0<h>>>0|e>>>0<l>>>0;e=d;d=d+M|0;f=e>>>0>d>>>0?f+1|0:f;j=d;g=f;e=vg(A,m,E,m);l=va;d=vg(G,m,N,m);h=d+e|0;f=va+l|0;f=d>>>0>h>>>0?f+1|0:f;d=f;f=(l|0)==(f|0)&e>>>0>h>>>0|f>>>0<l>>>0;x=d+j|0;e=f+g|0;e=d>>>0>x>>>0?e+1|0:e;l=x;g=e;e=0;d=e+w|0;f=h+n|0;f=d>>>0<e>>>0?f+1|0:f;e=f;h=(n|0)==(f|0)&d>>>0<w>>>0|f>>>0<n>>>0;f=g;g=h+l|0;f=g>>>0<h>>>0?f+1|0:f;w=g;g=f;h=d;j=e;e=(s|0)==(I|0)&y>>>0<H>>>0|s>>>0<I>>>0;d=(i|0)==(P|0)&z>>>0>F>>>0|i>>>0<P>>>0;i=(i|0)==(I|0)&F>>>0>H>>>0|i>>>0>I>>>0;d=d+i|0;d=d+e|0;n=s;i=n+h|0;e=d+j|0;f=g;d=i;e=d>>>0<n>>>0?e+1|0:e;h=(e|0)==(j|0)&h>>>0>d>>>0|e>>>0<j>>>0;g=h+w|0;f=h>>>0>g>>>0?f+1|0:f;j=g;g=f;h=d;f=0;i=e;n=(u|0)==(v|0)&r>>>0<D>>>0|u>>>0>v>>>0;l=n;n=n+((u|0)==(C|0)&B>>>0>D>>>0|u>>>0<C>>>0)|0;e=e+(l>>>0>n>>>0?1:f)|0;f=g;d=d+n|0;e=d>>>0<n>>>0?e+1|0:e;h=(e|0)==(i|0)&d>>>0<h>>>0|e>>>0<i>>>0;g=h;h=h+j|0;f=g>>>0>h>>>0?f+1|0:f;i=f;c:{if(f&65536){t=t+1|0;break c}j=q>>>31|0;g=0;f=i<<1|h>>>31;h=h<<1|e>>>31;i=f;f=e<<1|d>>>31;d=d<<1|c>>>31;e=f;f=q<<1|p>>>31;p=p<<1;q=f;f=c<<1|b>>>31;b=b<<1|j;c=f|g}if((t|0)>=32767){o=o|2147418112;b=0;c=0;break a}d:{if((t|0)<=0){g=1-t|0;if(g>>>0<=127){f=t+127|0;Xa(k+48|0,p,q,b,c,f);Xa(k+32|0,d,e,h,i,f);Fb(k+16|0,p,q,b,c,g);Fb(k,d,e,h,i,g);p=K[k+32>>2]|K[k+16>>2]|(K[k+48>>2]|K[k+56>>2]|(K[k+52>>2]|K[k+60>>2]))!=0;q=K[k+36>>2]|K[k+20>>2];b=K[k+40>>2]|K[k+24>>2];c=K[k+44>>2]|K[k+28>>2];d=K[k>>2];e=K[k+4>>2];g=K[k+8>>2];f=K[k+12>>2];break d}b=0;c=0;break a}g=h;f=i&65535|t<<16}m=g|m;o=f|o;if(!(!b&(c|0)==-2147483648?!(p|q):(c|0)>0|(c|0)>=0)){b=d+1|0;c=b?e:e+1|0;d=(e|0)==(c|0)&b>>>0<d>>>0|c>>>0<e>>>0;e=o;m=d+m|0;o=m>>>0<d>>>0?e+1|0:e;break a}if(b|p|(c^-2147483648|q)){b=d;c=e;break a}j=o;f=e;b=d&1;c=b;b=b+d|0;c=c>>>0>b>>>0?f+1|0:f;d=(f|0)==(c|0)&b>>>0<d>>>0|c>>>0<f>>>0;m=d+m|0;o=d>>>0>m>>>0?j+1|0:j}K[a>>2]=b;K[a+4>>2]=c;K[a+8>>2]=m;K[a+12>>2]=o;sa=k+96|0}function jb(a,b,c,d,e,f,g){var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0;h=sa-480|0;sa=h;K[h+476>>2]=0;K[h+456>>2]=0;K[h+460>>2]=0;K[h+448>>2]=0;K[h+452>>2]=0;K[h+440>>2]=0;K[h+444>>2]=0;K[h+432>>2]=0;K[h+436>>2]=0;i=0;a:{if(!K[a+684>>2]){break a}o=g?K[g>>2]:o;while(1){b:{k=L[b+i|0];I[(h+112|0)+i|0]=k;j=i+1|0;if(!k){break b}k=i>>>0<158;i=j;if(k){continue}}break}I[j+(h+112|0)|0]=0;r=f&268435456;if(!(r|!(K[47197]&8))){j=0;k=L[b|0];c:{if(!(k&223)){break c}i=0;while(1){I[(h+272|0)+i|0]=k;j=i+1|0;k=L[j+b|0];if(!(k&223)){break c}l=i>>>0<118;i=j;if(l){continue}break}}i=h+272|0;I[i+j|0]=0;K[h+48>>2]=i;Na(K[47195],(f|0)>=0?87019:86877,h+48|0)}K[h+464>>2]=b;K[a+8208>>2]=0;K[a+8212>>2]=0;if(e){I[e|0]=0}i=L[b|0];d:{e:{if(!(i&223)){break e}s=f&536870912;t=f&4096;u=h+105|0;j=b;k=0;while(1){l=Ga(h+476|0,j);q=((Ma(K[h+476>>2])|0)!=0)+q|0;m=i&255;i=m+a|0;n=L[i+7668|0];p=K[h+476>>2];f:{if(!(!(p-48>>>0<10|p-2406>>>0<10)|(q?L[a+170|0]:0))){I[h+104|0]=95;Fa(u,j,l);i=1;I[(h+l|0)+105|0]=0;Da(a,h+104|0,h- -64|0);if(k-1>>>0<=4294967293){i=h- -64|0;i=Ba(i)+i|0;I[i|0]=11;I[i+1|0]=0;i=0}Qc(a,c,d,h- -64|0);K[h+464>>2]=j+l;k=i;break f}g:{h:{k=K[h+476>>2]-K[a+600>>2]|0;if(k>>>0>127){break h}k=K[((k<<2)+a|0)+6192>>2];if(!k){break h}cc(a,h+464|0,b,l,k,h+448|0,f,o);break g}if(n){p=((m<<2)+a|0)+5168|0;i=L[i+7924|0];n=n+i|0;v=m|L[j+1|0]<<8;k=0;while(1){j=(i<<2)+a|0;i:{if(K[j+7184>>2]!=(v|0)){break i}K[h+472>>2]=K[h+464>>2];cc(a,h+472|0,b,2,K[j+6704>>2],h+432|0,f,o);j=K[h+432>>2];if((j|0)>0){j=j+35|0;K[h+432>>2]=j}k=1;cc(a,h+464|0,b,1,K[p>>2],h+448|0,f,o);if(K[h+448>>2]>(j|0)){break i}j=K[h+444>>2];K[h+456>>2]=K[h+440>>2];K[h+460>>2]=j;j=K[h+436>>2];K[h+448>>2]=K[h+432>>2];K[h+452>>2]=j;K[h+464>>2]=K[h+472>>2]}i=i+1|0;if(n>>>0>i>>>0){continue}break}if(k){break g}}j:{i=K[((m<<2)+a|0)+5168>>2];k:{if(!i){cc(a,h+464|0,b,0,K[a+5168>>2],h+448|0,f,o);if(K[h+448>>2]){break j}if(L[188808]&16){break k}j=K[h+464>>2];m=j-1|0;k=Ga(h+468|0,m);i=K[h+468>>2];if(!(K[a+600>>2]<=0|(i|0)>577)){if(uc(i)){K[h+32>>2]=21;Aa(c,87049,h+32|0);break d}i=K[h+468>>2]}l:{if((i|0)!=57384){break l}n=K[a+92>>2];if((n|0)<=K[47352]){break l}K[47352]=n}m:{if(!Qb(i)){break m}i=K[a+72>>2];if((i|0)<=K[47352]){break m}K[47352]=i}n:{i=K[h+468>>2];n=i-192|0;if(n>>>0>413){break n}n=L[n+94240|0];if(!n){break n}k=k-1|0;if(L[j-2|0]==32&L[k+j|0]==32){break n}K[h+472>>2]=m;I[m|0]=n;while(1){i=j;l=L[i+k|0];I[i|0]=l;j=i+1|0;if((l|0)!=32){continue}break}if((k|0)>0){Ea(i,32,k)}o:{if(!K[a+24>>2]){break o}if((rd(94222,K[h+468>>2])|0)<=0){break o}K[h+464>>2]=m;k=0;break f}k=0;I[c|0]=0;K[h+464>>2]=b;K[a+8208>>2]=0;K[a+8212>>2]=0;break f}i=hc(i);if(!i){break k}j=K[i+4>>2];if((j|0)==K[a+600>>2]){break k}if((j|0)==K[a+188>>2]){K[h+4>>2]=Bd(h- -64|0,K[a+192>>2]);K[h>>2]=21;Aa(c,87218,h);break d}if(!(L[i+16|0]&4)){break k}K[h+20>>2]=Bd(h- -64|0,K[i+12>>2]);K[h+16>>2]=21;Aa(c,87218,h+16|0);break d}cc(a,h+464|0,b,1,i,h+448|0,f,o);if(K[h+448>>2]){break j}}i=K[h+476>>2];p:{if(i-768>>>0<112){break p}if(Ma(i)){if(I[(l+K[h+464>>2]|0)-1|0]<33&(q|0)<=1){break p}I[c|0]=0;if(!g){break e}K[g>>2]=K[g>>2]|4096;break e}Db(a,K[h+476>>2],-1,h+272|0,0);if(!L[h+272|0]){break p}K[h+448>>2]=1;K[h+452>>2]=h+272}K[h+464>>2]=(l+K[h+464>>2]|0)-1;break g}K[a+288>>2]=0}i=K[h+452>>2];j=i?i:86135;K[h+452>>2]=j;k=0;if(K[h+448>>2]<=0){break f}i=K[h+456>>2]|1;if((f|0)<0){break a}if(!(L[j|0]!=21|t)){Ca(c,j);break d}if(!(!(K[47197]&8)|r)){q:{i=K[47195];l=K[i+76>>2];if(!((l|0)>=0&(!l|K[56823]!=(l&-1073741825)))){r:{if(K[i+80>>2]==10){break r}l=K[i+20>>2];if((l|0)==K[i+16>>2]){break r}K[i+20>>2]=l+1;I[l|0]=10;break q}ue(i);break q}l=i+76|0;m=K[l>>2];K[l>>2]=m?m:1073741823;s:{t:{if(K[i+80>>2]==10){break t}m=K[i+20>>2];if((m|0)==K[i+16>>2]){break t}K[i+20>>2]=m+1;I[m|0]=10;break s}ue(i)}K[l>>2]=0}}i=K[h+456>>2];l=i&-32769;K[h+456>>2]=l;if(!(!e|!l|(i&1024?s:0))){a=K[h+464>>2];Ca(e,j);c=a;a=h+112|0;i=l|(w=c-Fa(b,a,Ba(a))|0,x=0,y=(i&1151)==1024,y?w:x);break a}i=K[h+460>>2];if(i){I[i|0]=69}Qc(a,c,d,j)}j=K[h+464>>2];i=L[j|0];if(i&223){continue}break}}a=h+112|0;Fa(b,a,Ba(a))}i=0}sa=h+480|0;return i}function Me(a,b){var c=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0;d=sa-2976|0;sa=d;K[b>>2]=1;c=K[a+20>>2];h=d+2960|0;K[h>>2]=K[a+16>>2];K[h+4>>2]=c;c=K[a+12>>2];h=d+2952|0;K[h>>2]=K[a+8>>2];K[h+4>>2]=c;c=K[a+4>>2];K[d+2944>>2]=K[a>>2];K[d+2948>>2]=c;if(!K[50303]){Ac()}a:{b:{a=K[d+2948>>2];if(L[a|0]?a:0){break b}a=K[d+2944>>2];if(!a){a=K[d+2952>>2];a=a?a:85055;K[d+2944>>2]=a}c=d+80|0;La(c,a,60);Cc(c,0);f=Bc(201216,c);if(!f){break b}K[d+2948>>2]=K[f+4>>2]+1;if(L[d+2958|0]|(L[d+2956|0]|L[d+2957|0])){break b}a=K[f+8>>2];if(!L[202976]){break a}K[d+64>>2]=a;K[d+68>>2]=202976;a=202912;Aa(202912,87760,d- -64|0);break a}q=d+1536|0;o=sa-336|0;sa=o;p=d+2944|0;a=K[p+4>>2];c:{if(!a|!L[a|0]){break c}r=Ba(a);if((r|0)>=0){c=r>>>0>=79?79:r;k=1;while(1){a=xb(I[K[p+4>>2]+e|0]);I[(o+256|0)+e|0]=a;k=((a&255)==45)+k|0;a=(c|0)!=(e|0);e=e+1|0;if(a){continue}break}if((k|0)!=1){break c}}k=1}l=K[50303];d:{if((l|0)<=0){K[q>>2]=0;a=0;break d}h=(k|0)>=0;while(1){j=K[(u<<2)+201216>>2];e:{if(!$a(K[j+8>>2],88032,3)){break e}f:{g:{a=K[p+4>>2];if(a){if($a(a,91687,3)){break g}}K[q+(g<<2)>>2]=j;break f}h:{if(!h){if($a(K[j+8>>2],o+256|0,r)){break e}a=100;break h}a=100;i:{if(!k){break i}c=0;e=K[j+4>>2];s=L[e|0];if(!s){if(!$a(o+256|0,90013,9)){break i}break e}while(1){v=1;i=e+1|0;t=1;w=0;e=0;while(1){j:{if((e|0)<(r|0)){a=I[(o+256|0)+e|0];if((a|0)!=45){break j}}a=0}n=L[e+i|0];m=(n|0)==45;t=(m?0:n)<<24>>24==(a|0)?t:0;w=(m&(t|0)!=0)+w|0;e=e+1|0;v=m+v|0;if(n){continue}break}e=e+i|0;m=t+w|0;if(m){a=k-m|0;i=(a|0)<=0?5:5-a|0;a=v-m|0;a=Q(i-((a|0)>0?a:0)|0,100)-(s<<24>>24<<1)|0;c=(a|0)>(c|0)?a:c}s=L[e|0];if(s){continue}break}a=c;if(!a){break e}}c=K[p>>2];k:{if(!c){break k}if(!Oa(c,K[j>>2])){a=a+500|0;break k}a=Oa(c,K[j+8>>2])?a:a+400|0}e=L[p+12|0];l:{if((e-1&255)>>>0>1){break l}c=L[j+12|0];if((c-1&255)>>>0>1){break l}if((c|0)==(e|0)){a=a+50|0;break l}a=a-50|0}e=L[p+13|0];a=L[j+12|0]!=2|e>>>0>12?a:L[j+13|0]>12?a+5|0:a;c=L[j+13|0];if(c){c=((e?Q(e,100):3e3)>>>0)/(c>>>0)|0;if(c>>>0<=99){c=1e4/(c>>>0)|0}i=a;a=5-(((c-100&65535)>>>0)/10|0)|0;a=i+(a>>31&a)|0;a=e?a+10|0:a}a=(a|0)<=1?1:a}K[q+(g<<2)>>2]=j;K[j+16>>2]=a}g=g+1|0}u=u+1|0;if((l|0)!=(u|0)){continue}break}K[q+(g<<2)>>2]=0;a=0;if(!g){break d}oe(q,g,8);a=g}sa=o+336|0;k=a;if(!a){K[b>>2]=0;a=Bc(201216,85055);K[d+1536>>2]=a;k=(a|0)!=0}b=L[d+2957|0];a=L[d+2956|0];h=2;m:{if((a|0)==2){break m}h=2;if((b-1&255)>>>0<12){break m}y=(a|0)!=1;h=(a|0)==1}g=K[(h<<2)+132136>>2];n=b>>>0<60;l=g+n|0;a=0;n:{if((k|0)>0){c=0;while(1){f=K[(d+1536|0)+(x<<2)>>2];o:{p:{q:{r:{if(!y){b=L[f+12|0];if(c|n){break q}b=(b|0)!=(h|0);break r}if(n){break p}b=0;if(c){break p}}e=0;if(b|L[f+13|0]<60){break o}break p}if((b|0)==(h|0)){break p}e=c;break o}K[(d+80|0)+(c<<2)>>2]=f;e=c+1|0}s:{if(!L[f+15|0]){c=e;break s}m=0;b=a;c=e;if((a|0)>11){break s}while(1){t:{e=L[l|0];if(e){break t}l=g;e=L[g|0];if(e){break t}while(1)continue}a=K[f+12>>2];i=Q(b,24)+202624|0;K[i+8>>2]=K[f+8>>2];K[i+12>>2]=a;a=K[f+4>>2];K[i>>2]=K[f>>2];K[i+4>>2]=a;a=K[f+20>>2];K[i+16>>2]=K[f+16>>2];K[i+20>>2]=a;I[i+14|0]=e;K[(d+80|0)+(c<<2)>>2]=i;l=l+1|0;c=c+1|0;a=b+1|0;m=m+1|0;if(m>>>0>=L[f+15|0]){break s}e=(b|0)<11;b=a;if(e){continue}break}}x=x+1|0;if((x|0)!=(k|0)){continue}break}break n}if(!f){break a}c=0}e=L[l|0];u:{if(!e|(a|0)>=12){break u}while(1){b=K[f+12>>2];g=Q(a,24)+202624|0;K[g+8>>2]=K[f+8>>2];K[g+12>>2]=b;b=K[f+4>>2];K[g>>2]=K[f>>2];K[g+4>>2]=b;b=K[f+20>>2];K[g+16>>2]=K[f+16>>2];K[g+20>>2]=b;I[g+14|0]=e;K[(d+80|0)+(c<<2)>>2]=g;c=c+1|0;l=l+1|0;e=L[l|0];if(!e){break u}b=(a|0)<11;a=a+1|0;if(b){continue}break}}if(!c){a=0;break a}a=K[(d+80|0)+(L[d+2958|0]%(c|0)<<2)>>2];b=L[a+14|0];if(b){I[202976]=0;K[d+48>>2]=47;Aa(d+2971|0,91351,d+48|0);I[d+2971|0]=0;v:{if(b>>>0<=9){K[d+20>>2]=b;K[d+16>>2]=d+2971;Aa(202976,91378,d+16|0);break v}K[d+36>>2]=b-10;K[d+32>>2]=d+2971;Aa(202976,91503,d+32|0)}a=K[a+8>>2];K[d+4>>2]=202976;K[d>>2]=a;a=202912;Aa(202912,87760,d);break a}a=K[a+8>>2]}sa=d+2976|0;return a}function Jc(a,b,c,d,e){var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;f=sa-464|0;sa=f;I[f+432|0]=0;I[f+368|0]=0;I[f+304|0]=0;I[f+292|0]=0;k=(b|0)/10|0;g=K[33273];m=d&2;a:{b:{if(!(!m|K[33272]!=2)){Ca(e,g);break b}n=d&32?113:111;j=d&1;l=b-Q(k,10)|0;c:{d:{e:{f:{g:{h:{i:{j:{if(L[g|0]){g=0;break j}k:{l:{if(d&8){K[f+288>>2]=b;h=f+452|0;Aa(h,91198,f+288|0);g=Da(a,h,f+304|0);if(g){h=0;break j}K[f+272>>2]=b;h=f+452|0;Aa(h,91314,f+272|0);g=Da(a,h,f+304|0);h=0;break l}if(!j){break k}i=Ca(f+432|0,133104);if(d&4){K[f+260>>2]=n;K[f+256>>2]=b;h=f+452|0;Aa(h,91324,f+256|0);g=Da(a,h,f+304|0);if(L[133116]?g:0){break i}h=g;if(g){break j}}K[f+244>>2]=n;K[f+240>>2]=b;h=f+452|0;Aa(h,91384,f+240|0);g=Da(a,h,f+304|0);h=g}if(g){break j}}m:{n:{if(m){if(!(I[133096]&1)){break m}K[f+208>>2]=b;g=f+452|0;Aa(g,91498,f+208|0);g=Da(a,g,f+304|0);break n}i=K[a+108>>2];K[f+224>>2]=b;g=f+452|0;Aa(g,(c|0)>=2?91700:(i&262144)>>>18|0?91534:91700,f+224|0);g=Da(a,g,f+304|0)}if(g){break j}}if(!(!j|!(L[a+109|0]&32))){g=0;break j}K[f+192>>2]=b;g=f+452|0;Aa(g,91766,f+192|0);g=Da(a,g,f+304|0)}if(!(d&16)|(b|0)>9){break g}g=h;break h}Ca(i,133116);if(!(d&16)|(b|0)>9){break f}}Da(a,88875,f+368|0);break d}if(!g){break e}g=h}I[f+368|0]=0;break d}o:{p:{if(!j){break p}K[f+180>>2]=n;K[f+176>>2]=k;g=f+452|0;Aa(g,91846,f+176|0);if(!Da(a,g,f+368|0)){break p}h=1;if(!l|!(L[a+109|0]&16)){break o}Za(f+368|0,133104);break o}if(h){break o}K[f+160>>2]=k;h=f+452|0;Aa(h,d&512?91936:92016,f+160|0);Da(a,h,f+368|0);h=0}g=l;q:{if(L[f+368|0]){break q}g=l;if(!(L[a+106|0]&16)){break q}K[f+144>>2]=k&254;g=f+452|0;Aa(g,92016,f+144|0);Da(a,g,f+368|0);g=(b|0)%20|0}I[f+304|0]=0;k=g;if((g|0)<=0){g=h;break d}r:{if(!m){break r}g=K[33273];if(!L[g|0]){break r}Ca(f+304|0,g);I[f+432|0]=0;i=j;break c}i=0;if(d&8){K[f+128>>2]=k;d=f+452|0;Aa(d,91314,f+128|0);i=Da(a,d,f+304|0)}if(!(!j|L[a+104|0]&16)){K[f+116>>2]=n;K[f+112>>2]=k;d=f+452|0;Aa(d,91384,f+112|0);i=Da(a,d,f+304|0);h=i?1:h}g=h;if(i){break d}s:{t:{if(!(!m|!(K[33274]&1))){K[f+80>>2]=k;c=f+452|0;Aa(c,91498,f+80|0);c=Da(a,c,f+304|0);break t}if(L[a+104|0]&16?0:m){break s}h=K[a+108>>2];K[f+96>>2]=k;d=f+452|0;Aa(d,(c|0)>=2?91700:(h&262144)>>>18|0?91534:91700,f+96|0);c=Da(a,d,f+304|0)}if(c){break d}}K[f+64>>2]=k;c=f+452|0;Aa(c,91766,f- -64|0);Da(a,c,f+304|0)}i=j;if(L[f+432|0]|(g|!j)){break c}if(!((b|0)<20|(L[a+104|0]&16?0:l))){Da(a,92162,f+432|0);i=1;if(L[f+432|0]){break c}}Da(a,92205,f+432|0);i=1}c=I[f+304|0];b=K[a+104>>2];if(!(!c|(!(b&48)|!L[f+368|0]))){Da(a,90824,f+292|0);if(!(!i|!(L[a+109|0]&8))){I[f+292|0]=0}if(L[a+104|0]&16){K[f+28>>2]=f+432;K[f+24>>2]=f+368;K[f+20>>2]=f+292;K[f+16>>2]=f+304;Aa(e,91059,f+16|0);d=1;break a}K[f+12>>2]=f+432;K[f+8>>2]=f+304;K[f+4>>2]=f+292;K[f>>2]=f+368;Aa(e,91059,f);d=1;break a}u:{if(!(b&512)){break u}b=Ba(f+368|0)-1|0;if(!c|(b|0)<0){break u}b=b+(f+368|0)|0;g=L[K[(I[b|0]<<2)+144464>>2]+11|0]!=2;d=L[K[(c<<2)+144464>>2]+11|0];if((d|0)==1){d=L[K[(I[f+305|0]<<2)+144464>>2]+11|0]}if(g|(d&255)!=2){break u}I[b|0]=0}if(!(!(L[a+110|0]&8)|!L[f+432|0])){K[f+36>>2]=f+304;K[f+32>>2]=f+368;b=Aa(e,90368,f+32|0);if((b|0)>0){c=b-1|0;b=L[K[(L[c+e|0]<<2)+144464>>2]+11|0]==2?c:b}Ca(b+e|0,f+432|0);break b}K[f+56>>2]=f+432;K[f+52>>2]=f+304;K[f+48>>2]=f+368;Aa(e,92282,f+48|0)}d=0}a=K[a+104>>2];v:{if(a&268435456){if((Ba(e)|0)<=0){break v}b=0;a=0;while(1){c=a+e|0;if(L[c|0]==6){if(b){I[c|0]=5}b=1}a=a+1|0;if((Ba(e)|0)>(a|0)){continue}break}break v}if(!(a&256)){break v}b=0;j=Ba(e);a=j-1|0;if((a|0)<0){break v}if(a){l=j&-2;g=0;while(1){h=a+e|0;w:{if(L[h|0]!=6){c=b;break w}c=1;if(!b){break w}I[h|0]=5}h=h-1|0;x:{if(L[h|0]!=6){b=c;break x}b=1;if(!c){break x}I[h|0]=5}a=a-2|0;g=g+2|0;if((l|0)!=(g|0)){continue}break}}if(!(j&1)){break v}a=a+e|0;if(!b|L[a|0]!=6){break v}I[a|0]=5}sa=f+464|0;return d}function pd(a,b,c,d){var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;e=sa-352|0;sa=e;I[e+304|0]=0;I[e+224|0]=0;I[e+64|0]=0;h=K[K[47192]+292>>2];m=Ga(e+348|0,b);f=K[e+348>>2];if((f&1048320)==57344){f=f&255;K[e+348>>2]=f}a:{if(!(d&2)){break a}if(!wb(f)){break a}Da(a,85437,e+304|0)}f=dc(K[e+348>>2],a);K[e+348>>2]=f;l=b+m|0;k=d&1;Db(a,f,I[l|0],e+224|0,k);b=L[e+224|0];if(!b){b=Gd(K[e+348>>2]);b:{if(!b){break b}K[e+348>>2]=b&16383;if(!(d&4)){break b}c:{b=b>>14;switch(b&1073741823){case 0:case 3:break b;default:break c}}b=K[(b<<2)+131232>>2];Da(a,b,e+304|0);if(L[e+304|0]){break b}I[e+306|0]=ic(84744);j=b;b=e+304|3;Da(K[47194],j,b);if(!L[e+307|0]){break b}J[e+304>>1]=5385;b=Ba(b)+(e+304|0)|0;I[b+5|0]=0;I[b+4|0]=h;I[b+3|0]=21}Db(a,K[e+348>>2],I[l|0],e+224|0,k);b=L[e+224|0]}b=b&255;d:{e:{if(b){if((b|0)!=21){break e}Ca(c,e+224|0);m=0;break d}b=1632;f=K[e+348>>2];if((f|0)<1632){break e}i=103360;while(1){if((f|0)>=(b+10|0)){i=i+4|0;b=K[i>>2];if(!b){break e}if((b|0)<=(f|0)){continue}break e}break}b=(f-b|0)+48|0;if((b|0)<=0){break e}Db(a,b,0,e+224|0,k)}f:{g:{h:{i:{b=hc(K[e+348>>2]);if(b){f=K[b+4>>2];i=K[b+16>>2];j:{if(!b|i&1){break j}g=K[47192];if(K[g+600>>2]==(f|0)|K[g+188>>2]==(f|0)|K[g+184>>2]==(f|0)){break j}I[e+144|0]=0;k:{if(!Da(g,K[b>>2],e- -64|0)){I[e+66|0]=ic(84744);Da(K[47194],K[b>>2],e+144|0);break k}g=K[47192];if((g|0)==(a|0)){break k}h=K[a+292>>2];Ca(e+144|0,e- -64|0);I[e+66|0]=K[g+292>>2]}if(!L[e+144|0]){break j}J[e+64>>1]=5385;g=e- -64|0;j=e+144|0;Ca(g|3,j);g=Ba(j)+g|0;I[g+5|0]=0;I[g+4|0]=h;I[g+3|0]=21}if(L[e+224|0]){break f}if(!f){break i}h=K[47192];if(K[h+188>>2]!=(f|0)){break i}b=K[h+192>>2];break g}if(L[e+224|0]){break f}i=0;f=0;break h}b=K[b+12>>2];if(!b){break h}if(!(i&2)){break g}}b=25966}if(!(K[a+212>>2]==(b|0)&(b|0)!=27503)){I[e+226|0]=ic(Bd(e+47|0,b));b=K[47194];l:{if(!b){break l}m:{n:{h=K[e+348>>2];if((h|0)>55215){break n}g=h-44032|0;if((g|0)<0){break n}I[e+52|0]=32;j=e+53|0;b=j;if(h-50500>>>0>=588){b=Pa(((g>>>0)/588|0)+4352|0,j)+j|0}h=(g>>>0)/28|0;Pa(((h>>>0)%21|0)+4449|0,b);Pa((g-Q(h,28)|0)+4519|0,b+3|0);I[b+6|0]=32;I[b+7|0]=0;I[e+227|0]=0;b=e+224|3;jb(K[47194],j,b,77,0,0,0);kb(K[47194],b,0,-1,0);break m}Db(b,h,I[l|0],e+224|3,k)}b=e+224|3;if(L[e+227|0]==21){I[e+226|0]=ic(e+224|4);Db(K[47194],K[e+348>>2],I[l|0],b,k)}ab(K[K[32972]+60>>2]);if(!L[e+227|0]){break l}J[e+224>>1]=5385;b=Ba(b)+(e+224|0)|0;I[b+3|0]=21;k=K[a+292>>2];I[b+5|0]=0;I[b+4|0]=k}if(L[e+224|0]){break f}}o:{if(i&16){break o}if(pb(K[e+348>>2])){Da(K[47192],85683,e+224|0)}if(L[e+224|0]){break o}if(!Sa(K[e+348>>2])){Da(K[47192],85778,e+224|0)}if(L[e+224|0]){break o}Rc(85992,e+224|0,0)}if(!(i&8?d&4:1)){break f}b=K[e+348>>2];p:{if((f|0)==10240){f=e+52|0;if(b&1){I[e+52|0]=49;f=e+53|0}if(b&2){I[f|0]=50;f=f+1|0}if(b&4){I[f|0]=51;f=f+1|0;b=K[e+348>>2]}if(b&8){I[f|0]=52;f=f+1|0;b=K[e+348>>2]}if(b&16){I[f|0]=53;f=f+1|0;b=K[e+348>>2]}if(b&32){I[f|0]=54;f=f+1|0;b=K[e+348>>2]}if(b&64){I[f|0]=55;f=f+1|0;b=K[e+348>>2]}if(b&128){I[f|0]=56;f=f+1|0}I[f|0]=0;break p}K[e+32>>2]=b;Aa(e+52|0,86013,e+32|0)}b=e+224|0;i=L[e+52|0];if(i){f=e+52|0;while(1){b=Ba(b)+b|0;I[b|0]=23;b=b+1|0;Db(K[47192],i<<24>>24,0,b,1);d=L[b|0];q:{if(d?(d|0)!=21:0){break q}d=I[f|0];if((d|0)<97){break q}Rc(K[((d&255)<<2)+130860>>2],b,0)}f=f+1|0;i=L[f|0];if(i){continue}break}}b=Ba(b)+b|0;I[b|0]=9;I[b+1|0]=0}b=Ba(c);r:{if(L[a+144|0]&2){K[e+16>>2]=255;K[e+28>>2]=e+304;K[e+24>>2]=e+224;K[e+20>>2]=e- -64;Aa(e+144|0,86210,e+16|0);break r}K[e>>2]=255;K[e+12>>2]=e+224;K[e+8>>2]=e+304;K[e+4>>2]=e- -64;Aa(e+144|0,86210,e)}if(Ba(e+144|0)+b>>>0>199){break d}Ca(b+c|0,e+144|0)}sa=e+352|0;return m}function Pc(a,b,c,d,e,f,g){var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,E=0;m=sa-528|0;sa=m;r=g?K[g>>2]:0;x=K[e+4>>2];a:{b:{c:{if(K[a+220>>2]>0){i=m+352|0;La(i,b,160);n=sa-176|0;sa=n;o=K[a+220>>2];p=1-o|0;q=K[a+224>>2];s=K[a+216>>2];k=i;d:{e:{while(1){f:{t=Ga(n+172|0,k);h=K[n+172>>2];if(!h){h=l;break f}if((h|0)<(o|0)|(h|0)>(s|0)){break e}g:{if(!q){h=h+p|0;break g}h=I[q+(h-o|0)|0];if((h|0)<=0){break e}}k=k+t|0;I[l+n|0]=h;h=160;l=l+1|0;if((l|0)!=160){continue}}break}q=0;I[h+n|0]=0;p=I[n|0];K[n+172>>2]=p;h:{if(!p){o=n;break h}y=(s-o|0)+2|0;h=n;o=h;while(1){s=h+1|0;t=K[a+8180>>2];i:{j:{if(!t){break j}l=0;k=J[t>>1];v=(I[s|0]<<8)+p|0;if((k|0)>(v|0)){break j}while(1){if((k|0)==(v|0)){p=l+y|0;K[n+172>>2]=p;h=h+2|0;break i}l=l+1|0;k=J[t+(l<<1)>>1];if((v|0)>=(k|0)){continue}break}}h=s}u=p&63|u<<6;l=q+6|0;k:{if((l|0)<8){q=l;break k}q=q-2|0;I[o|0]=u>>q;o=o+1|0}p=I[h|0];K[n+172>>2]=p;if(p){continue}break}if((q|0)<=0){break h}I[o|0]=u<<8-q;o=o+1|0}I[o|0]=0;h=o-n|0;Fa(i,n,h);o=h|64;break d}o=Ba(i)}sa=n+176|0;n=i;break c}o=Ba(b);n=b}i=L[n|0];if(i){h=0;l=n;while(1){j=(j<<3)+i|0;j=j&1023^j>>>8;h=h+1|0;l=l+1|0;i=L[l|0];if(i){continue}break}h=h+j&1023}else{h=0}j=K[((h<<2)+a|0)+692>>2];if(j){h=L[j|0];if(h){break b}h=0;break a}h=0;if(!e){break a}K[e>>2]=0;break a}t=x&1073741824;v=f&2048;x=r&512;y=r&65536;z=r&1;A=r&2;r=f&8;B=f&1024;s=f&4;C=o&63;E=a+8233|0;while(1){f=(h&255)+j|0;l:{m:{h=L[j+1|0];if((h&127)!=(o|0)){break m}if($a(n,j+2|0,C)){break m}j=((h&63)+j|0)+2|0;n:{o:{if(h<<24>>24<0){q=0;I[d|0]=0;break o}q=Ba(j);if((q|0)>=160){break n}Ca(d,j);j=(j+q|0)+1|0}i=0;p:{if(f>>>0<=j>>>0){h=c;k=0;break p}l=0;k=0;q:{while(1){h=j;j=h+1|0;h=L[h|0];r:{if(h>>>0>=100){p=K[a+320>>2];if(h>>>0>=132){l=p>>>h-132&1|l;break r}l=!(p>>>h-100&1)|l;break r}if(h>>>0>=81){p=h-80|0;u=f-j|0;s:{if(!g){break s}h=0;while(1){w=Q(h,12)+g|0;if(!L[w+10|0]){break s}l=(L[w+1|0]&12)!=0|l;w=(h|0)!=(p|0);h=h+1|0;if(w){continue}break}}if(le(c,j,u)|l&1){break m}K[33264]=p;h=c+u|0;k=k|128;j=f;break q}if(h>>>0>=65){k=h&15|k&-16;k=(h&12)==12?k|512:k;break r}if(h>>>0>=32){i=1<<h-32|i;break r}k=1<<h|k}if(f>>>0>j>>>0){continue}break}h=c;if(l&1){break l}}if(!(i&65536?s:1)){break l}if(!B){break p}if(i&49152){break l}}t:{if(!s){break t}if(i&16384){break l}if(r){break t}if(i&32768){break l}}if((A?0:i&512)|(z?0:i&1024)|(y?0:k&33554432)){break l}if(!(!(i&131072)|N[K[47192]+8204>>2]<=h>>>0|t)|((x?0:i&262144)|(L[K[47192]+8242|0]&8?0:i&8192))){break l}u:{if(!(i&16)){break u}if(!K[a+8184>>2]&(!r|!K[a+8192>>2])){break l}if(!r|K[a+212>>2]!=25966){break u}if(K[a+8232>>2]&2097152){break l}}if((K[a+8188>>2]?0:i&64)|(!K[a+8196>>2]|v?i&32:0)){break l}if(!(!(k&65536)|K[a+212>>2]!=26741|L[E|0]&128)|(K[47192]!=(a|0)?i&524288:0)){break l}v:{w:{x:{if(!e){if(!q){break x}break v}K[e+4>>2]=i;K[e>>2]=k|1073741824;if(q){break w}}h=0;if(!(L[188788]&8)){break a}a=m+272|0;Pd(e,a);K[m>>2]=b;K[m+4>>2]=a;Na(K[47195],89330,m);break a}K[e>>2]=k|-1073741824}y:{if(!(L[188788]&8)){break y}Ab(d,m- -64|0);if(L[K[47192]+172|0]!=(k>>>29&1)){break y}z:{if(!(!g|!(k&128))){a=m+352|0;d=c;c=h-c|0;Fa(a,d,c);I[(c+m|0)+351|0]=0;K[m+32>>2]=b;K[m+36>>2]=a;Na(K[47195],89397,m+32|0);break z}K[m+48>>2]=b;Na(K[47195],89426,m+48|0)}a=m+272|0;Pd(e,a);b=K[47195];K[m+16>>2]=m- -64;K[m+20>>2]=a;Na(b,89534,m+16|0)}if(L[Ga(m- -64|0,n)+n|0]|!e){break a}if(Ma(K[m+64>>2])){break a}K[e>>2]=K[e>>2]|134217728;break a}da(89236,86634,2467,94846);D()}j=f}h=L[j|0];if(h){continue}break}h=0}sa=m+528|0;return h}function kg(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;i=fb(408);K[i+4>>2]=d;K[i>>2]=c;if(b){Fa(i+16|0,b,376);P[i+392>>3]=(P[b+368>>3]-P[b>>3])/+(c>>>0);b=0}else{b=1}K[i+400>>2]=e;I[i+8|0]=b;a:{if(!f){break a}c=K[a+24>>2];if(c){b=K[a+20>>2];d=K[a+8>>2];while(1){e=K[K[(b>>>8&16777212)+d>>2]+((b&1023)<<2)>>2];if(e){Ha(e);c=K[a+24>>2];d=K[a+8>>2];b=K[a+20>>2]}b=b+1|0;K[a+20>>2]=b;c=c-1|0;K[a+24>>2]=c;if(b>>>0>=2048){Ha(K[d>>2]);d=K[a+8>>2]+4|0;K[a+8>>2]=d;b=K[a+20>>2]-1024|0;K[a+20>>2]=b;c=K[a+24>>2]}if(c){continue}break}}b=K[a+28>>2];K[a+420>>2]=K[b>>2];c=K[a+32>>2];if(!c){break a}I[b+8|0]=L[c+8|0];Fa(b+16|0,a+40|0,376);b=K[a+32>>2];if(b){Ha(b)}K[a+32>>2]=0}d=K[a+24>>2];c=d+K[a+20>>2]|0;e=K[a+12>>2];b=K[a+8>>2];if((c|0)==(((b|0)!=(e|0)?(e-b<<8)-1|0:0)|0)){g=sa-32|0;sa=g;b:{c:{d:{e:{f=a+4|0;b=K[f+16>>2];if(b>>>0>=1024){K[f+16>>2]=b-1024;b=K[f+4>>2];m=K[b>>2];e=b+4|0;K[f+4>>2]=e;b=K[f+8>>2];f:{if((b|0)!=K[f+12>>2]){c=b;break f}h=K[f>>2];if(h>>>0<e>>>0){d=((e-h>>2)+1|0)/-2<<2;b=b-e|0;c=zc(d+e|0,e,b)+b|0;K[f+8>>2]=c;K[f+4>>2]=d+K[f+4>>2];break f}c=(b|0)==(h|0)?1:b-h>>1;if(c>>>0>=1073741824){break e}d=c<<2;j=fb(d);n=d+j|0;d=j+(c&-4)|0;c=d;g:{if((b|0)==(e|0)){break g}b=b-e|0;o=b&-4;k=b-4|0;l=(k>>>2|0)+1&7;h:{if(!l){b=d;break h}c=0;b=d;while(1){K[b>>2]=K[e>>2];e=e+4|0;b=b+4|0;c=c+1|0;if((l|0)!=(c|0)){continue}break}}c=d+o|0;if(k>>>0<28){break g}while(1){K[b>>2]=K[e>>2];K[b+4>>2]=K[e+4>>2];K[b+8>>2]=K[e+8>>2];K[b+12>>2]=K[e+12>>2];K[b+16>>2]=K[e+16>>2];K[b+20>>2]=K[e+20>>2];K[b+24>>2]=K[e+24>>2];K[b+28>>2]=K[e+28>>2];e=e+32|0;b=b+32|0;if((c|0)!=(b|0)){continue}break}}K[f+12>>2]=n;K[f+8>>2]=c;K[f+4>>2]=d;K[f>>2]=j;if(!h){break f}Ha(h);c=K[f+8>>2]}K[c>>2]=m;K[f+8>>2]=K[f+8>>2]+4;break b}e=K[f+8>>2];h=e-K[f+4>>2]>>2;b=K[f+12>>2];c=K[f>>2];d=b-c|0;if(h>>>0<d>>2>>>0){if((b|0)!=(e|0)){K[g+8>>2]=fb(4096);Ee(f,g+8|0);break b}K[g+8>>2]=fb(4096);De(f,g+8|0);b=K[f+4>>2];m=K[b>>2];e=b+4|0;K[f+4>>2]=e;b=K[f+8>>2];i:{if((b|0)!=K[f+12>>2]){c=b;break i}h=K[f>>2];if(h>>>0<e>>>0){d=((e-h>>2)+1|0)/-2<<2;b=b-e|0;c=zc(d+e|0,e,b)+b|0;K[f+8>>2]=c;K[f+4>>2]=d+K[f+4>>2];break i}c=(b|0)==(h|0)?1:b-h>>1;if(c>>>0>=1073741824){break e}d=c<<2;j=fb(d);n=d+j|0;d=j+(c&-4)|0;c=d;j:{if((b|0)==(e|0)){break j}b=b-e|0;o=b&-4;k=b-4|0;l=(k>>>2|0)+1&7;k:{if(!l){b=d;break k}c=0;b=d;while(1){K[b>>2]=K[e>>2];e=e+4|0;b=b+4|0;c=c+1|0;if((l|0)!=(c|0)){continue}break}}c=d+o|0;if(k>>>0<28){break j}while(1){K[b>>2]=K[e>>2];K[b+4>>2]=K[e+4>>2];K[b+8>>2]=K[e+8>>2];K[b+12>>2]=K[e+12>>2];K[b+16>>2]=K[e+16>>2];K[b+20>>2]=K[e+20>>2];K[b+24>>2]=K[e+24>>2];K[b+28>>2]=K[e+28>>2];e=e+32|0;b=b+32|0;if((c|0)!=(b|0)){continue}break}}K[f+12>>2]=n;K[f+8>>2]=c;K[f+4>>2]=d;K[f>>2]=j;if(!h){break i}Ha(h);c=K[f+8>>2]}K[c>>2]=m;K[f+8>>2]=K[f+8>>2]+4;break b}K[g+24>>2]=f+12;b=(b|0)==(c|0)?1:d>>1;if(b>>>0>=1073741824){break e}c=b<<2;b=fb(c);K[g+8>>2]=b;d=b+(h<<2)|0;K[g+16>>2]=d;K[g+20>>2]=b+c;K[g+12>>2]=d;K[g+4>>2]=fb(4096);Ee(g+8|0,g+4|0);e=K[f+8>>2];if((e|0)==K[f+4>>2]){b=e;break c}while(1){e=e-4|0;De(g+8|0,e);if(K[f+4>>2]!=(e|0)){continue}break}break d}hd();D()}b=K[f+8>>2]}c=K[f>>2];K[f>>2]=K[g+8>>2];K[g+8>>2]=c;K[f+4>>2]=K[g+12>>2];K[g+12>>2]=e;K[f+8>>2]=K[g+16>>2];K[g+16>>2]=b;d=K[f+12>>2];K[f+12>>2]=K[g+20>>2];K[g+20>>2]=d;if((b|0)!=(e|0)){K[g+16>>2]=b+((e-b|0)+3&-4)}if(!c){break b}Ha(c)}sa=g+32|0;d=K[a+24>>2];c=d+K[a+20>>2]|0;b=K[a+8>>2]}K[K[b+(c>>>8&16777212)>>2]+((c&1023)<<2)>>2]=i;K[a+24>>2]=d+1}function Cd(a,b,c,d,e){var f=0,g=0,h=0;g=sa-304|0;sa=g;I[g+278|0]=0;a:{if((b|0)>0){if(d&1){if(d&2){K[g+164>>2]=c;K[g+160>>2]=b;f=g+290|0;Aa(f,89701,g+160|0);f=Da(a,f,g+224|0);if(f){break a}}if(I[133096]&1){K[g+148>>2]=c;K[g+144>>2]=b;f=g+290|0;Aa(f,89757,g+144|0);f=Da(a,f,g+224|0);if(f){break a}}K[g+132>>2]=c;K[g+128>>2]=b;f=g+290|0;Aa(f,89894,g+128|0);f=Da(a,f,g+224|0);if(f){break a}}K[g+116>>2]=c;K[g+112>>2]=b;f=g+290|0;Aa(f,89974,g+112|0);f=Da(a,f,g+224|0);if(f){break a}}h=(b|0)%100|0;if((h|0)>=20){Da(a,90022,g+278|0)}b:{if(!(d&1)){d=h-11|0;break b}if(d&2){f=h-11|0;c:{d:{e:{switch((K[K[47192]+108>>2]&448)+-64>>>6|0){case 0:if(f>>>0<9){break d}f=(b|0)%10|0;d=90418;if((f|0)==1){break c}if(f-2>>>0>=3){break d}d=90453;break c;case 1:if(b-2>>>0>=3){break d}d=90453;break c;case 2:if(f>>>0<9|((b|0)%10|0)-2>>>0>=3){break d}d=90453;break c;case 3:d=90508;if(f>>>0<9){break c}d=(b|0)%10|0;d=d?(d|0)==1?90453:90586:90508;break c;case 4:break e;default:break d}}if(f>>>0<9){break d}f=(b|0)%10|0;d=90537;if((f|0)==1){break c}if(f-2>>>0>=3){break d}d=90453;break c}d=90586}K[g+100>>2]=c;K[g+96>>2]=d;d=g+290|0;Aa(d,90058,g+96|0);f=0;if(Da(a,d,g+224|0)){break a}}d=h-11|0;if(I[133096]&1){f:{g:{h:{switch((K[K[47192]+108>>2]&448)+-64>>>6|0){case 0:if(d>>>0<9){break g}h=(b|0)%10|0;f=90418;if((h|0)==1){break f}if(h-2>>>0>=3){break g}f=90453;break f;case 1:if(b-2>>>0>=3){break g}f=90453;break f;case 2:if(d>>>0<9|((b|0)%10|0)-2>>>0>=3){break g}f=90453;break f;case 3:f=90508;if(d>>>0<9){break f}f=(b|0)%10|0;f=f?(f|0)==1?90453:90586:90508;break f;case 4:break h;default:break g}}if(d>>>0<9){break g}h=(b|0)%10|0;f=90537;if((h|0)==1){break f}if(h-2>>>0>=3){break g}f=90453;break f}f=90586}K[g+84>>2]=c;K[g+80>>2]=f;h=g+290|0;Aa(h,90110,g+80|0);f=0;if(Da(a,h,g+224|0)){break a}}i:{j:{k:{switch((K[K[47192]+108>>2]&448)+-64>>>6|0){case 0:if(d>>>0<9){break j}h=(b|0)%10|0;f=90418;if((h|0)==1){break i}if(h-2>>>0>=3){break j}f=90453;break i;case 1:if(b-2>>>0>=3){break j}f=90453;break i;case 2:if(d>>>0<9|((b|0)%10|0)-2>>>0>=3){break j}f=90453;break i;case 3:f=90508;if(d>>>0<9){break i}f=(b|0)%10|0;f=f?(f|0)==1?90453:90586:90508;break i;case 4:break k;default:break j}}if(d>>>0<9){break j}h=(b|0)%10|0;f=90537;if((h|0)==1){break i}if(h-2>>>0>=3){break j}f=90453;break i}f=90586}K[g+68>>2]=c;K[g+64>>2]=f;h=g+290|0;Aa(h,90139,g- -64|0);f=0;if(Da(a,h,g+224|0)){break a}}l:{m:{n:{switch((K[K[47192]+108>>2]&448)+-64>>>6|0){case 0:if(d>>>0<9){break m}d=(b|0)%10|0;f=90418;if((d|0)==1){break l}if(d-2>>>0>=3){break m}f=90453;break l;case 1:if(b-2>>>0>=3){break m}f=90453;break l;case 2:if(d>>>0<9|((b|0)%10|0)-2>>>0>=3){break m}f=90453;break l;case 3:f=90508;if(d>>>0<9){break l}d=(b|0)%10|0;f=d?(d|0)==1?90453:90586:90508;break l;case 4:break n;default:break m}}if(d>>>0<9){break m}d=(b|0)%10|0;f=90537;if((d|0)==1){break l}if(d-2>>>0>=3){break m}f=90453;break l}f=90586}K[g+52>>2]=c;K[g+48>>2]=f;d=g+290|0;Aa(d,90218,g+48|0);f=0;if(Da(a,d,g+224|0)){break a}o:{if((c|0)<4){break o}K[g+32>>2]=c-1;d=g+290|0;Aa(d,89026,g+32|0);if(Da(a,d,g+176|0)){break o}Da(a,90273,g+224|0);K[33275]=3}if(L[g+224|0]){break a}K[g+16>>2]=b;d=g+290|0;Aa(d,90303,g+16|0);f=Da(a,d,g+224|0);if(!f){Da(a,90347,g+224|0)}K[33275]=2}K[g+4>>2]=g+224;K[g>>2]=g+278;Aa(e,90368,g);sa=g+304|0;p:{if(!((b|0)!=1|(c|0)!=1)){b=1;if(L[a+106|0]&32){break p}}b=f}return b}function Oc(a,b,c,d){var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;i=sa+-64|0;sa=i;J[i+48>>1]=0;K[i+40>>2]=0;K[i+44>>2]=0;K[i+32>>2]=0;K[i+36>>2]=0;K[i+24>>2]=0;K[i+28>>2]=0;K[i+16>>2]=0;K[i+20>>2]=0;K[i+8>>2]=0;K[i+12>>2]=0;K[i>>2]=0;K[i+4>>2]=0;e=b;a:{while(1){b:{f=L[e|0];c:{if((f|0)!=69){if((f|0)!=32){break c}if(d){f=d;d=e-b|0;d=(d|0)>=159?159:d;I[Fa(f,b,d)+d|0]=0}d=c&63;if(d){break b}break a}I[e|0]=101}e=e+1|0;continue}break}d:{if(!(c&1)){g=d;f=d;break d}e=e-1|0;e:{if(e>>>0<b>>>0){f=d;break e}f=d;while(1){if((L[e|0]&192)!=128){break e}f=f+1|0;e=e-1|0;if(e>>>0>=b>>>0){continue}break}}g=d-1|0}if((d|0)!=1){while(1){d=g;e=e-1|0;f:{if(e>>>0<b>>>0){break f}while(1){if((L[e|0]&192)!=128){break f}f=f+1|0;e=e-1|0;if(e>>>0>=b>>>0){continue}break}}e=e-1|0;g:{if(e>>>0<b>>>0){break g}while(1){if((L[e|0]&192)!=128){break g}f=f+1|0;e=e-1|0;if(e>>>0>=b>>>0){continue}break}}g=d-2|0;if((d|0)>2){continue}break}}if((f|0)<=0){g=0;break a}b=f-1|0;d=b>>>0>=48?48:b;g=d+1|0;h=g&3;b=0;f=0;if(d>>>0>=3){l=g&-4;d=0;while(1){j=e+f|0;I[f+i|0]=L[j|0];I[j|0]=32;k=f|1;j=k+e|0;I[i+k|0]=L[j|0];I[j|0]=32;k=f|2;j=k+e|0;I[i+k|0]=L[j|0];I[j|0]=32;k=f|3;j=k+e|0;I[i+k|0]=L[j|0];I[j|0]=32;f=f+4|0;d=d+4|0;if((l|0)!=(d|0)){continue}break}}if(!h){break a}while(1){d=e+f|0;I[f+i|0]=L[d|0];I[d|0]=32;f=f+1|0;b=b+1|0;if((h|0)!=(b|0)){continue}break}}I[i+g|0]=0;h=c&65520;d=e-1|0;if(!(!(c&512)|L[d|0]!=105)){I[d|0]=121}f=h|4;h:{if(!(c&256)){break h}i:{j:{k:{b=K[a+212>>2];if((b|0)!=25966){if((b|0)!=28268){break k}if(I[d|0]<0){break i}g=e-2|0;b=I[g|0];if(b&128){break i}h=K[a+632>>2];l:{if(h){b=(Ta(h,b)|0)!=0;break l}h=K[a+600>>2];if((h|0)>0){b=b-h|0;if(b-1>>>0>254){break i}}b=L[(a+b|0)+344|0]&128}if(!b){break i}b=I[d|0];h=K[a+612>>2];m:{if(h){b=(Ta(h,b)|0)!=0;break m}h=K[a+600>>2];n:{if((h|0)>0){b=b-h|0;if(b-1>>>0<255){break n}break i}if((b|0)<0){break i}}b=L[(a+b|0)+344|0]&4}if(!b){break i}b=I[e-3|0];h=K[a+632>>2];o:{p:{if(h){b=(Ta(h,b)|0)!=0;break p}h=K[a+600>>2];q:{if((h|0)>0){b=b-h|0;if(b-1>>>0<255){break q}break o}if((b|0)<0){break o}}b=L[(a+b|0)+344|0]&128}if(b){break i}}I[e|0]=L[d|0];I[d|0]=L[g|0];I[e+1|0]=32;break i}g=I[e-2|0];b=K[a+632>>2];r:{if(b){b=(Ta(b,g)|0)!=0;break r}b=K[a+600>>2];s:{if((b|0)>0){g=g-b|0;if(g-1>>>0<255){break s}break j}if((g|0)<0){break j}}b=L[(a+g|0)+344|0]&128}if(!b){break j}g=I[d|0];b=K[a+608>>2];t:{if(b){b=(Ta(b,g)|0)!=0;break t}b=K[a+600>>2];u:{if((b|0)>0){g=g-b|0;if(g-1>>>0>=255){break j}break u}if((g|0)<0){break j}}b=L[(a+g|0)+344|0]&2}if(!b){break j}f=$a(87771,e-3|0,3)?h|20:f;break i}f=K[a+204>>2]?h|20:f;break i}v:{if(L[d|0]==99){break v}b=e-2|0;g=L[b+1|0]<<8;if((L[b|0]|g)==29554|(g|L[b|0])==29289){break v}b=e-2|0;if((L[b|0]|L[b+1|0]<<8)==29301){break v}if(!$a(88115,e-3|0,3)){break v}b=e-2|0;if((L[b|0]|L[b+1|0]<<8)==29550|L[d|0]==117){break v}if(!$a(88384,e-5|0,5)){break v}b=e-4|0;if((L[b|0]|L[b+1|0]<<8|(L[b+2|0]<<16|L[b+3|0]<<24))==1735287154){break v}if((L[b|0]|L[b+1|0]<<8|(L[b+2|0]<<16|L[b+3|0]<<24))!=1735549292){break i}}f=h|20}if(!(f&16)){break h}Pa(K[a+204>>2],e);if(!(L[188788]&8)){break h}bd(88683,6,K[47195])}if(!(K[a+8184>>2]|!(c&2048))){K[a+8184>>2]=1}w:{if(M[i>>1]!=115){if($a(i,88850,3)){break w}}f=f|8}sa=i- -64|0;return L[i|0]==39?f&65531:f}function cb(a,b,c,d,e,f,g,h,i){var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;j=sa-112|0;sa=j;k=i&2147483647;a:{b:{l=e&2147483647;m=!(b|c);if(!(d|l?l-2147418112>>>0<2147549184:m)){o=k-2147418112|0;if(!h&(o|0)==-2147418112?f|g:(o|0)==-2147418112&(h|0)!=0|o>>>0>2147549184){break b}}if(!(!d&(l|0)==2147418112?m:l>>>0<2147418112)){h=d;i=e|32768;f=b;g=c;break a}if(!(!h&(k|0)==2147418112?!(f|g):k>>>0<2147418112)){i=i|32768;break a}if(!(b|d|(l^2147418112|c))){n=d;d=!(b^f|d^h|(c^g|e^i^-2147483648));h=d?0:n;i=d?2147450880:e;f=d?0:b;g=d?0:c;break a}if(!(f|h|(k^2147418112|g))){break a}if(!(b|d|(c|l))){if(f|h|(g|k)){break a}f=b&f;g=c&g;h=d&h;i=e&i;break a}if(f|h|(g|k)){break b}f=b;g=c;h=d;i=e;break a}n=(k|0)==(l|0);r=n&(d|0)==(h|0)?(c|0)==(g|0)&b>>>0<f>>>0|c>>>0<g>>>0:n&d>>>0<h>>>0|k>>>0>l>>>0;m=r;l=m?f:b;o=m?g:c;n=m?i:e;s=n;m=m?h:d;q=n&65535;d=r?d:h;e=r?e:i;t=e;n=e>>>16&32767;p=s>>>16&32767;if(!p){e=!(m|q);i=e;k=e?l:m;e=e<<6;h=e;i=T(i?o:q);e=e+((i|0)==32?T(k)+32|0:i)|0;Xa(j+96|0,l,o,m,q,e-15|0);m=K[j+104>>2];q=K[j+108>>2];o=K[j+100>>2];p=16-e|0;l=K[j+96>>2]}f=r?b:f;g=r?c:g;h=d;i=t&65535;if(!n){b=!(h|i);e=b;k=b?f:h;b=b<<6;c=b;e=T(e?g:i);b=b+((e|0)==32?T(k)+32|0:e)|0;Xa(j+80|0,f,g,h,i,b-15|0);n=16-b|0;h=K[j+88>>2];i=K[j+92>>2];g=K[j+84>>2];f=K[j+80>>2]}c=i<<3|h>>>29;b=h<<3|g>>>29;c=c|524288;h=m<<3|o>>>29;i=q<<3|m>>>29;r=s^t;e=g<<3|f>>>29;d=f<<3;c:{if((n|0)==(p|0)){break c}f=p-n|0;if(f>>>0>127){b=0;c=0;e=0;d=1;break c}Xa(j- -64|0,d,e,b,c,128-f|0);Fb(j+48|0,d,e,b,c,f);b=K[j+56>>2];c=K[j+60>>2];e=K[j+52>>2];d=K[j+48>>2]|(K[j+64>>2]|K[j+72>>2]|(K[j+68>>2]|K[j+76>>2]))!=0}m=d;k=e;n=h;q=i|524288;e=o<<3|l>>>29;o=l<<3;l=e;d:{if((r|0)<0){f=0;g=0;h=0;i=0;if(!(m^o|b^n|(k^l|c^q))){break a}d=o-m|0;e=l-((m>>>0>o>>>0)+k|0)|0;f=n-b|0;g=(k|0)==(l|0)&m>>>0>o>>>0|k>>>0>l>>>0;h=f-g|0;b=(q-((b>>>0>n>>>0)+c|0)|0)-(f>>>0<g>>>0)|0;i=b;if(b>>>0>524287){break d}b=!(h|i);f=b;g=b?d:h;b=b<<6;c=b;f=T(f?e:i);b=b+((f|0)==32?T(g)+32|0:f)|0;b=b-12|0;Xa(j+32|0,d,e,h,i,b);p=p-b|0;h=K[j+40>>2];i=K[j+44>>2];d=K[j+32>>2];e=K[j+36>>2];break d}e=k+l|0;d=m+o|0;e=d>>>0<o>>>0?e+1|0:e;f=(k|0)==(e|0)&d>>>0<m>>>0|e>>>0<k>>>0;k=c+q|0;b=b+n|0;k=b>>>0<n>>>0?k+1|0:k;h=b+f|0;i=h>>>0<b>>>0?k+1|0:k;if(!(i&1048576)){break d}d=m&1|((e&1)<<31|d>>>1);e=h<<31|e>>>1;p=p+1|0;h=(i&1)<<31|h>>>1;i=i>>>1|0}c=0;l=s&-2147483648;if((p|0)>=32767){h=c;i=l|2147418112;f=0;g=0;break a}n=0;e:{if((p|0)>0){n=p;break e}Xa(j+16|0,d,e,h,i,p+127|0);Fb(j,d,e,h,i,1-p|0);d=K[j>>2]|(K[j+16>>2]|K[j+24>>2]|(K[j+20>>2]|K[j+28>>2]))!=0;e=K[j+4>>2];h=K[j+8>>2];i=K[j+12>>2]}o=d&7;d=(e&7)<<29|d>>>3;f=(o>>>0>4)+d|0;b=h<<29|e>>>3;g=d>>>0>f>>>0?b+1|0:b;d=(b|0)==(g|0)&d>>>0>f>>>0|b>>>0>g>>>0;b=c|((i&7)<<29|h>>>3);h=d+b|0;i=l|(i>>>3&65535|n<<16);i=b>>>0>h>>>0?i+1|0:i;f:{if((o|0)==4){b=0;k=g+b|0;d=f;c=f&1;f=f+c|0;g=d>>>0>f>>>0?k+1|0:k;b=(b|0)==(g|0)&c>>>0>f>>>0|b>>>0>g>>>0;h=b+h|0;i=b>>>0>h>>>0?i+1|0:i;break f}if(!o){break a}}}K[a>>2]=f;K[a+4>>2]=g;K[a+8>>2]=h;K[a+12>>2]=i;sa=j+112|0}function Ha(a){a=a|0;var b=0,c=0,d=0,e=0,f=0,g=0,h=0;a:{if(!a){break a}d=a-8|0;b=K[a-4>>2];a=b&-8;f=d+a|0;b:{if(b&1){break b}if(!(b&3)){break a}b=K[d>>2];d=d-b|0;if(d>>>0<N[57156]){break a}a=a+b|0;if(K[57157]!=(d|0)){if(b>>>0<=255){e=K[d+8>>2];b=b>>>3|0;c=K[d+12>>2];if((c|0)==(e|0)){K[57152]=K[57152]&yg(-2,b);break b}K[e+12>>2]=c;K[c+8>>2]=e;break b}h=K[d+24>>2];b=K[d+12>>2];c:{if((d|0)!=(b|0)){c=K[d+8>>2];K[c+12>>2]=b;K[b+8>>2]=c;break c}d:{e=d+20|0;c=K[e>>2];if(c){break d}e=d+16|0;c=K[e>>2];if(c){break d}b=0;break c}while(1){g=e;b=c;e=b+20|0;c=K[e>>2];if(c){continue}e=b+16|0;c=K[b+16>>2];if(c){continue}break}K[g>>2]=0}if(!h){break b}e=K[d+28>>2];c=(e<<2)+228912|0;e:{if(K[c>>2]==(d|0)){K[c>>2]=b;if(b){break e}K[57153]=K[57153]&yg(-2,e);break b}K[h+(K[h+16>>2]==(d|0)?16:20)>>2]=b;if(!b){break b}}K[b+24>>2]=h;c=K[d+16>>2];if(c){K[b+16>>2]=c;K[c+24>>2]=b}c=K[d+20>>2];if(!c){break b}K[b+20>>2]=c;K[c+24>>2]=b;break b}b=K[f+4>>2];if((b&3)!=3){break b}K[57154]=a;K[f+4>>2]=b&-2;K[d+4>>2]=a|1;K[a+d>>2]=a;return}if(d>>>0>=f>>>0){break a}b=K[f+4>>2];if(!(b&1)){break a}f:{if(!(b&2)){if(K[57158]==(f|0)){K[57158]=d;a=K[57155]+a|0;K[57155]=a;K[d+4>>2]=a|1;if(K[57157]!=(d|0)){break a}K[57154]=0;K[57157]=0;return}if(K[57157]==(f|0)){K[57157]=d;a=K[57154]+a|0;K[57154]=a;K[d+4>>2]=a|1;K[a+d>>2]=a;return}a=(b&-8)+a|0;g:{if(b>>>0<=255){e=K[f+8>>2];b=b>>>3|0;c=K[f+12>>2];if((c|0)==(e|0)){K[57152]=K[57152]&yg(-2,b);break g}K[e+12>>2]=c;K[c+8>>2]=e;break g}h=K[f+24>>2];b=K[f+12>>2];h:{if((f|0)!=(b|0)){c=K[f+8>>2];K[c+12>>2]=b;K[b+8>>2]=c;break h}i:{e=f+20|0;c=K[e>>2];if(c){break i}e=f+16|0;c=K[e>>2];if(c){break i}b=0;break h}while(1){g=e;b=c;e=b+20|0;c=K[e>>2];if(c){continue}e=b+16|0;c=K[b+16>>2];if(c){continue}break}K[g>>2]=0}if(!h){break g}e=K[f+28>>2];c=(e<<2)+228912|0;j:{if(K[c>>2]==(f|0)){K[c>>2]=b;if(b){break j}K[57153]=K[57153]&yg(-2,e);break g}K[h+(K[h+16>>2]==(f|0)?16:20)>>2]=b;if(!b){break g}}K[b+24>>2]=h;c=K[f+16>>2];if(c){K[b+16>>2]=c;K[c+24>>2]=b}c=K[f+20>>2];if(!c){break g}K[b+20>>2]=c;K[c+24>>2]=b}K[d+4>>2]=a|1;K[a+d>>2]=a;if(K[57157]!=(d|0)){break f}K[57154]=a;return}K[f+4>>2]=b&-2;K[d+4>>2]=a|1;K[a+d>>2]=a}if(a>>>0<=255){b=(a&-8)+228648|0;c=K[57152];a=1<<(a>>>3);k:{if(!(c&a)){K[57152]=a|c;a=b;break k}a=K[b+8>>2]}K[b+8>>2]=d;K[a+12>>2]=d;K[d+12>>2]=b;K[d+8>>2]=a;return}e=31;if(a>>>0<=16777215){b=T(a>>>8|0);e=((a>>>38-b&1)-(b<<1)|0)+62|0}K[d+28>>2]=e;K[d+16>>2]=0;K[d+20>>2]=0;g=(e<<2)+228912|0;l:{m:{c=K[57153];b=1<<e;n:{if(!(c&b)){K[57153]=b|c;K[g>>2]=d;K[d+24>>2]=g;break n}e=a<<((e|0)!=31?25-(e>>>1|0)|0:0);b=K[g>>2];while(1){c=b;if((K[b+4>>2]&-8)==(a|0)){break m}b=e>>>29|0;e=e<<1;g=c+(b&4)|0;b=K[g+16>>2];if(b){continue}break}K[g+16>>2]=d;K[d+24>>2]=c}K[d+12>>2]=d;K[d+8>>2]=d;break l}a=K[c+8>>2];K[a+12>>2]=d;K[c+8>>2]=d;K[d+24>>2]=0;K[d+12>>2]=c;K[d+8>>2]=a}a=K[57160]-1|0;K[57160]=a?a:-1}}function ob(a,b,c){var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;e=sa-176|0;sa=e;a:{b:{if(b&32){n=c-((c|0)>1)|0;break b}f=Ra(a,93302);c:{d:{e:{if((b|0)!=2){if(f){break e}b=0;break a}n=c+1|0;o=Q(c,76)+133152|0;l=o+56|0;m=Ra(a,89360);g=Ra(a,93318);h=Ra(a,93426);i=Ra(a,93499);if(f){break d}break c}n=c+1|0;o=Q(c,76)+133152|0;l=o+56|0;i=0}a=0;d=K[f-4>>2];j=(d|0)!=34?(d|0)==39?d:0:d;p=Q(c,76)+133208|0;while(1){d=a;a=K[f>>2];if(!a){break c}f:{if(!j){if((a|0)==32|a-9>>>0<5){break c}if((a|0)!=47){break f}break c}if((d|0)==92){break f}if((a|0)==(j|0)){break c}}f=f+4|0;k=Pa(a,k+p|0)+k|0;if((k|0)<16){continue}break}}j=0;I[k+l|0]=0;k=Q(c,76)+133168|0;f=0;g:{if(!m){break g}a=0;d=K[m-4>>2];l=(d|0)!=34?(d|0)==39?d:0:d;while(1){d=a;a=K[m>>2];if(!a){break g}h:{if(!l){if((a|0)==32|a-9>>>0<5){break g}if((a|0)!=47){break h}break g}if((d|0)==92){break h}if((a|0)==(l|0)){break g}}m=m+4|0;f=Pa(a,f+k|0)+f|0;if((f|0)<36){continue}break}}I[f+k|0]=0;i:{if(!g|K[g>>2]-48>>>0>=10){break i}while(1){j=(K[g>>2]+Q(j,10)|0)-48|0;g=g+4|0;if(K[g>>2]-48>>>0<10){continue}break}if((j|0)<=0){break i}j=j-1|0}d=Q(c,76)+133152|0;K[d+4>>2]=j;a=0;f=0;if(!(!h|K[h>>2]-48>>>0>=10)){while(1){f=(K[h>>2]+Q(f,10)|0)-48|0;h=h+4|0;if(K[h>>2]-48>>>0<10){continue}break}}K[d+12>>2]=f;f=Q(c,76)+133152|0;j:{k:{if(!i){break k}while(1){l:{c=I[a+93099|0];d=K[(a<<2)+i>>2];if(!d){break l}a=a+1|0;if((c|0)==(d|0)){continue}}break}m:{n:{switch(d-34|0){case 0:case 5:break n;default:break m}}if(c){break m}a=0;break j}a=0;while(1){o:{c=I[a+93116|0];d=K[(a<<2)+i>>2];if(!d){break o}a=a+1|0;if((c|0)==(d|0)){continue}}break}p:{q:{switch(d-34|0){case 0:case 5:break q;default:break p}}if(c){break p}a=1;break j}a=0;while(1){r:{c=I[a+93197|0];d=K[(a<<2)+i>>2];if(!d){break r}a=a+1|0;if((c|0)==(d|0)){continue}}break}s:{switch(d-34|0){case 0:case 5:break s;default:break k}}if(c){break k}a=2;break j}a=3}K[f+8>>2]=K[(a<<3)+131156>>2];K[o>>2]=b}Ca(137776,133168);c=Ca(e+96|0,133208);I[e+157|0]=K[33291];I[e+156|0]=K[33290];a=K[33289];K[e+152>>2]=0;I[e+158|0]=a;if((n|0)>0){g=0;while(1){h=1;b=Q(g,76)+133152|0;a=b+16|0;t:{if(!L[a|0]){break t}if(!Bc(0,a)){break t}Ca(137776,a);h=0;I[c|0]=0;I[e+158|0]=0;J[e+156>>1]=0}a=b+56|0;u:{if(!L[a|0]){break u}i=Ca(c,a);d=K[33679];a=d;v:{if(!L[a|0]){break v}while(1){a=a+1|0;if(!Oa(a,i)){Ca(i,d+1|0);break v}a=(Ba(a)+a|0)+1|0;if(L[a|0]){continue}break}}if(!h){break u}I[137776]=0}a=K[b+8>>2];if(a){I[e+156|0]=a}a=K[b+12>>2];if(a){I[e+157|0]=a}a=K[b+4>>2];if(a){I[e+158|0]=a}g=g+1|0;if((n|0)!=(g|0)){continue}break}}K[e+148>>2]=c;K[e+144>>2]=137776;a=Me(e+144|0,e+172|0);w:{if(!a){a=92003;break w}if(mb(a,43)){break w}b=L[e+156|0];if(!L[134672]|((b|0)!=L[134724]?b:0)){break w}K[e>>2]=a;K[e+4>>2]=134672;b=e+16|0;Aa(b,93533,e);a=137776;La(137776,b,40)}b=0;if(!Oa(a,134784)){break a}Ca(134784,a);b=131072}sa=e+176|0;return b}function Xd(a,b){var c=0,d=0,e=0,f=0,g=0,h=0;f=a+b|0;c=K[a+4>>2];a:{b:{if(c&1){break b}if(!(c&3)){break a}c=K[a>>2];b=c+b|0;c:{a=a-c|0;if((a|0)!=K[57157]){if(c>>>0<=255){e=K[a+8>>2];c=c>>>3|0;d=K[a+12>>2];if((d|0)!=(e|0)){break c}K[57152]=K[57152]&yg(-2,c);break b}h=K[a+24>>2];c=K[a+12>>2];d:{if((c|0)!=(a|0)){d=K[a+8>>2];K[d+12>>2]=c;K[c+8>>2]=d;break d}e:{e=a+20|0;d=K[e>>2];if(d){break e}e=a+16|0;d=K[e>>2];if(d){break e}c=0;break d}while(1){g=e;c=d;e=c+20|0;d=K[e>>2];if(d){continue}e=c+16|0;d=K[c+16>>2];if(d){continue}break}K[g>>2]=0}if(!h){break b}e=K[a+28>>2];d=(e<<2)+228912|0;f:{if(K[d>>2]==(a|0)){K[d>>2]=c;if(c){break f}K[57153]=K[57153]&yg(-2,e);break b}K[h+(K[h+16>>2]==(a|0)?16:20)>>2]=c;if(!c){break b}}K[c+24>>2]=h;d=K[a+16>>2];if(d){K[c+16>>2]=d;K[d+24>>2]=c}d=K[a+20>>2];if(!d){break b}K[c+20>>2]=d;K[d+24>>2]=c;break b}c=K[f+4>>2];if((c&3)!=3){break b}K[57154]=b;K[f+4>>2]=c&-2;K[a+4>>2]=b|1;K[f>>2]=b;return}K[e+12>>2]=d;K[d+8>>2]=e}c=K[f+4>>2];g:{if(!(c&2)){if(K[57158]==(f|0)){K[57158]=a;b=K[57155]+b|0;K[57155]=b;K[a+4>>2]=b|1;if(K[57157]!=(a|0)){break a}K[57154]=0;K[57157]=0;return}if(K[57157]==(f|0)){K[57157]=a;b=K[57154]+b|0;K[57154]=b;K[a+4>>2]=b|1;K[a+b>>2]=b;return}b=(c&-8)+b|0;h:{if(c>>>0<=255){e=K[f+8>>2];c=c>>>3|0;d=K[f+12>>2];if((d|0)==(e|0)){K[57152]=K[57152]&yg(-2,c);break h}K[e+12>>2]=d;K[d+8>>2]=e;break h}h=K[f+24>>2];c=K[f+12>>2];i:{if((f|0)!=(c|0)){d=K[f+8>>2];K[d+12>>2]=c;K[c+8>>2]=d;break i}j:{d=f+20|0;e=K[d>>2];if(e){break j}d=f+16|0;e=K[d>>2];if(e){break j}c=0;break i}while(1){g=d;c=e;d=c+20|0;e=K[d>>2];if(e){continue}d=c+16|0;e=K[c+16>>2];if(e){continue}break}K[g>>2]=0}if(!h){break h}e=K[f+28>>2];d=(e<<2)+228912|0;k:{if(K[d>>2]==(f|0)){K[d>>2]=c;if(c){break k}K[57153]=K[57153]&yg(-2,e);break h}K[h+(K[h+16>>2]==(f|0)?16:20)>>2]=c;if(!c){break h}}K[c+24>>2]=h;d=K[f+16>>2];if(d){K[c+16>>2]=d;K[d+24>>2]=c}d=K[f+20>>2];if(!d){break h}K[c+20>>2]=d;K[d+24>>2]=c}K[a+4>>2]=b|1;K[a+b>>2]=b;if(K[57157]!=(a|0)){break g}K[57154]=b;return}K[f+4>>2]=c&-2;K[a+4>>2]=b|1;K[a+b>>2]=b}if(b>>>0<=255){c=(b&-8)+228648|0;d=K[57152];b=1<<(b>>>3);l:{if(!(d&b)){K[57152]=b|d;b=c;break l}b=K[c+8>>2]}K[c+8>>2]=a;K[b+12>>2]=a;K[a+12>>2]=c;K[a+8>>2]=b;return}e=31;if(b>>>0<=16777215){c=T(b>>>8|0);e=((b>>>38-c&1)-(c<<1)|0)+62|0}K[a+28>>2]=e;K[a+16>>2]=0;K[a+20>>2]=0;g=(e<<2)+228912|0;m:{d=K[57153];c=1<<e;n:{if(!(d&c)){K[57153]=c|d;K[g>>2]=a;K[a+24>>2]=g;break n}e=b<<((e|0)!=31?25-(e>>>1|0)|0:0);c=K[g>>2];while(1){d=c;if((K[c+4>>2]&-8)==(b|0)){break m}c=e>>>29|0;e=e<<1;g=d+(c&4)|0;c=K[g+16>>2];if(c){continue}break}K[g+16>>2]=a;K[a+24>>2]=d}K[a+12>>2]=a;K[a+8>>2]=a;return}b=K[d+8>>2];K[b+12>>2]=a;K[d+8>>2]=a;K[a+24>>2]=0;K[a+12>>2]=d;K[a+8>>2]=b}}function ke(a){var b=0,c=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;b=I[88105];if(!b){return a}a=mb(a,b);a:{if(!a){break a}if(!L[88106]){return a}if(!L[a+1|0]){break a}if(!L[88107]){c=L[a+1|0];e=(c|0)!=0;b:{if(!c){break b}b=c|L[a|0]<<8;h=L[88106]|L[88105]<<8;if((b|0)==(h|0)){break b}c=a+1|0;while(1){a=c;d=L[a+1|0];e=(d|0)!=0;if(!d){break b}c=a+1|0;b=d|b<<8&65280;if((h|0)!=(b|0)){continue}break}}return e?a:0}if(!L[a+2|0]){break a}if(!L[88108]){c=a+2|0;b=L[a+2|0];e=(b|0)!=0;c:{d:{if(!b){break d}b=L[a+1|0]<<16|L[a|0]<<24|b<<8;h=L[88106]<<16|L[88105]<<24|L[88107]<<8;if((b|0)==(h|0)){break d}while(1){a=c+1|0;d=L[c+1|0];e=(d|0)!=0;if(!d){break c}c=a;b=(b|d)<<8;if((h|0)!=(b|0)){continue}break}break c}a=c}return e?a-2|0:0}if(!L[a+3|0]){break a}if(!L[88109]){c=a+3|0;b=L[a+3|0];e=(b|0)!=0;e:{f:{if(!b){break f}b=b|(L[a+1|0]<<16|L[a|0]<<24|L[a+2|0]<<8);a=L[88105]|L[88106]<<8|(L[88107]<<16|L[88108]<<24);h=a<<24|(a&65280)<<8|(a>>>8&65280|a>>>24);if((b|0)==(h|0)){break f}while(1){a=c+1|0;d=L[c+1|0];e=(d|0)!=0;if(!d){break e}c=a;b=d|b<<8;if((h|0)!=(b|0)){continue}break}break e}a=c}return e?a-3|0:0}h=a;i=sa-1056|0;sa=i;a=i+1048|0;K[a>>2]=0;K[a+4>>2]=0;a=i+1040|0;K[a>>2]=0;K[a+4>>2]=0;K[i+1032>>2]=0;K[i+1036>>2]=0;K[i+1024>>2]=0;K[i+1028>>2]=0;g:{h:{i:{j:{b=L[88105];k:{if(!b){j=-1;a=1;break k}while(1){if(!L[f+h|0]){break h}f=f+1|0;K[((b&255)<<2)+i>>2]=f;a=(i+1024|0)+(b>>>3&28)|0;K[a>>2]=K[a>>2]|1<<b;b=L[f+88105|0];if(b){continue}break}a=1;j=-1;if(f>>>0>1){break j}}g=-1;c=1;break i}d=1;b=1;while(1){g=L[(b+j|0)+88105|0];e=L[a+88105|0];l:{if((g|0)==(e|0)){if((b|0)==(d|0)){c=c+d|0;b=1;break l}b=b+1|0;break l}if(e>>>0<g>>>0){d=a-j|0;c=a;b=1;break l}j=c;c=c+1|0;d=1;b=1}a=c+b|0;if(f>>>0>a>>>0){continue}break}c=1;g=-1;if(f>>>0<=1){a=d;break i}a=0;e=1;b=1;while(1){l=L[(b+g|0)+88105|0];k=L[c+88105|0];m:{if((l|0)==(k|0)){if((b|0)==(e|0)){a=a+e|0;b=1;break m}b=b+1|0;break m}if(k>>>0>l>>>0){e=c-g|0;a=c;b=1;break m}g=a;a=a+1|0;e=1;b=1}c=a+b|0;if(f>>>0>c>>>0){continue}break}a=d;c=e}b=a;a=g+1>>>0>j+1>>>0;d=a?c:b;k=a?g:j;l=k+1|0;n:{if($a(88105,d+88105|0,l)){a=(k^-1)+f|0;d=(a>>>0<k>>>0?k:a)+1|0;e=0;break n}e=f-d|0}n=f-1|0;m=f|63;g=0;a=h;while(1){o:{if(h-a>>>0>=f>>>0){break o}c=Wb(h,0,m);if(c){h=c;if(c-a>>>0<f>>>0){break h}break o}h=h+m|0}c=L[a+n|0];b=f;p:{q:{if(!(K[(i+1024|0)+(c>>>3&28)>>2]>>>c&1)){break q}c=K[(c<<2)+i>>2];if((c|0)!=(f|0)){c=f-c|0;b=c>>>0>g>>>0?c:g;break q}r:{b=l;c=b>>>0>g>>>0?b:g;j=L[c+88105|0];if(j){while(1){if(L[a+c|0]!=(j&255)){break r}c=c+1|0;j=L[c+88105|0];if(j){continue}break}}while(1){if(b>>>0<=g>>>0){break g}b=b-1|0;if(L[b+88105|0]==L[a+b|0]){continue}break}b=d;g=e;break p}b=c-k|0}g=0}a=a+b|0;continue}}a=0}sa=i+1056|0;c=a}return c}function Kc(a,b,c,d,e,f){var g=0,h=0,i=0,j=0,k=0,l=0,m=0;g=sa-560|0;sa=g;I[g+448|0]=0;I[g+144|0]=0;I[g+120|0]=0;k=f&34;i=(b|0)/100|0;j=b-Q(i,100)|0;l=L[a+106|0]&64?(b|0)>999|f:0;a:{if(!(l&1|(b|0)>99)){h=f;break a}b:{c:{d:{if(!(!k|j)){if(!Da(a,90606,g+304|0)){break d}break b}if(j){break c}}if(Da(a,90691,g+304|0)){break b}}Da(a,90725,g+304|0)}h=f;e:{if((b|0)<1e3){break e}h=f;if(!(!(L[a+105|0]&8)|b-2e3>>>0<4294967196)){break e}I[g+208|0]=0;h=(i>>>0)/10|0;d=K[a+108>>2]&16384?0:e+1|0;if(!Cd(a,h,d,!((b>>>0)%1e3|0)|k,g+272|0)){Jc(a,h,e,K[a+212>>2]==28012?520:(d|0)<4?(K[a+108>>2]>>>d&1)<<3:0,g+208|0)}f:{if(L[a+109|0]&2){K[g+108>>2]=15;K[g+100>>2]=15;K[g+104>>2]=g+208;K[g+96>>2]=g+272;Aa(g+144|0,90761,g+96|0);break f}K[g+92>>2]=15;K[g+84>>2]=15;K[g+88>>2]=g+272;K[g+80>>2]=g+208;Aa(g+144|0,90761,g+80|0)}d=1;i=i-Q(h,10)|0;if(!(((i|0)!=0|l)&1)){I[g+304|0]=0}h=f|1}I[g+208|0]=0;g:{if((l^-1)&(i|0)<=0){break g}if(!(!(L[a+106|0]&4)|!(h&1|L[g+144|0]))){Da(a,90824,g+120|0)}h:{if(!k|(L[a+109|0]&16?0:j)){break h}K[g+64>>2]=i;d=g+548|0;Aa(d,90875,g- -64|0);m=Da(a,d,g+208|0);if(!(K[a+108>>2]&4096)|(j|0)<=0){break h}Za(g+208|0,133104)}d=1;if(!((l^-1|(i|0)!=0)&1)){Da(a,88875,g+208|0);break g}i:{j:{k:{l:{if(K[a+108>>2]&131072?h&1|(i|0)!=1:1){if(!(j|m)){K[g+48>>2]=i;d=g+548|0;Aa(d,90985,g+48|0);m=Da(a,d,g+208|0)}if(m){break l}K[g+32>>2]=i;d=g+548|0;Aa(d,91027,g+32|0);if(Da(a,d,g+208|0)){break l}if((i|0)!=1){break j}break k}if(!m){break k}}I[g+304|0]=0;break i}d=1;if(L[a+105|0]&4){break g}}Jc(a,i,e,0,g+208|0)}d=1}K[g+28>>2]=g+304;K[g+24>>2]=g+208;K[g+20>>2]=g+120;K[g+16>>2]=g+144;Aa(g+448|0,91059,g+16|0)}I[g+132|0]=0;m:{n:{o:{if((j|0)>0){p:{if(L[a+109|0]&16?h&2:0){break p}q:{if(!(h&1)|e?(b|0)<=100:0){break q}d=K[a+104>>2];if(!(d&64)&(!(d&8388608)|j>>>0>9)){break q}Da(a,90824,g+132|0)}if(!(h&1|L[g+144|0])|(!(K[a+104>>2]&524288)|i)){break p}Da(a,90824,g+132|0)}I[g+336|0]=0;break o}I[g+336|0]=0;if(!j&d){break n}}r:{if(!e){d=k?3:2;b=f&32|((b|0)<100?h&1?d:d|4:d);f=K[a+108>>2];break r}f=K[a+108>>2];b=(e|0)<4?(f>>>e&1)<<3:0}b=(e|0)==1?K[a+212>>2]==28012?b|520:b:b;if(f&1048576){d=b|16;b=(i|0)>0?d:h&1?d:b}if(!Jc(a,j,e,h&256|b,g+336|0)|!(L[a+104|0]&128)){break m}I[g+132|0]=0;break m}if(!L[133104]){break m}a=Ba(g+448|0);s:{if((a|0)<=0){break s}a=a+g|0;if(L[a+447|0]!=10){break s}I[a+447|0]=0}Ca(g+336|0,133104)}K[g+8>>2]=15;K[g+12>>2]=g+336;K[g+4>>2]=g+132;K[g>>2]=g+448;Aa(c,91101,g);sa=g+560|0}function Oe(a){var b=0,c=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;b=K[32972];K[b+64>>2]=290816;K[b+68>>2]=4104;K[b+96>>2]=0;K[b+100>>2]=0;K[b+120>>2]=90;K[b+124>>2]=100;K[b+112>>2]=64;K[b+116>>2]=256;K[b+104>>2]=5;K[b+108>>2]=0;K[b+84>>2]=100;K[b+88>>2]=64;c=K[50754];K[b+132>>2]=0;K[b+136>>2]=0;K[b+128>>2]=c;K[b+140>>2]=0;K[b+144>>2]=0;K[b+148>>2]=0;K[b+152>>2]=0;K[b+156>>2]=0;K[b+160>>2]=0;K[36435]=450;K[b+92>>2]=2;K[50870]=0;K[50871]=0;K[50872]=0;K[50873]=0;K[50880]=0;K[50881]=0;K[50882]=0;K[50883]=0;K[50890]=0;K[50891]=0;K[50892]=0;K[50893]=0;d=-3.141592653589793/+K[50754];P[25429]=d;f=d*-2;P[25430]=f;d=nb(d*200);g=d*-d;P[25434]=g;P[25439]=g;P[25444]=g;f=d*hb(f*2e3);d=f+f;P[25433]=d;P[25438]=d;P[25443]=d;f=1-d-g;P[25432]=f;P[25437]=f;P[25442]=f;K[50902]=0;K[50903]=0;K[50900]=0;K[50901]=0;P[25449]=g;P[25448]=d;K[50912]=0;K[50913]=0;P[25447]=f;K[50910]=0;K[50911]=0;P[25454]=g;P[25453]=d;K[50922]=0;K[50923]=0;P[25452]=f;K[50920]=0;K[50921]=0;P[25459]=g;P[25458]=d;K[50932]=0;K[50933]=0;P[25457]=f;K[50930]=0;K[50931]=0;P[25464]=g;P[25463]=d;P[25462]=f;K[50942]=0;K[50943]=0;K[50940]=0;K[50941]=0;P[25469]=g;P[25468]=d;P[25467]=f;K[50952]=0;K[50953]=0;K[50950]=0;K[50951]=0;P[25474]=g;P[25473]=d;P[25472]=f;k=K[32972];c=0;while(1){h=(c<<1)+k|0;J[h+236>>1]=256;J[h+164>>1]=256;b=L[c+105376|0]<<1;J[h+254>>1]=b;J[h+182>>1]=b;J[h+200>>1]=L[c+105385|0]<<1;e=c<<2;b=e+k|0;K[b+308>>2]=K[e+105408>>2];K[b+272>>2]=0;J[h+218>>1]=0;K[e+200944>>2]=(Q(K[e+105456>>2],22050)|0)/K[50754];c=c+1|0;if((c|0)!=9){continue}break}m=K[32961];c=0;n=k+344|0;while(1){b=i;j=m;h=c;e=c<<2;c=e+131840|0;i=K[c>>2];a:{if((i|0)!=-1){break a}i=8e3;K[c>>2]=8e3;if(!h){break a}K[(e|4)+131840>>2]=K[e+131836>>2]}m=K[(e|4)+131840>>2];i=(i|0)/8|0;b:{if((b|0)>=(i|0)){break b}l=i-b|0;if((l|0)<=0){break b}e=b+1|0;c=b;if(l&1){I[(b+k|0)+344|0]=(j|0)>=255?255:j;c=e}if((e|0)==(i|0)){break b}o=m-j|0;while(1){e=((Q(c-b|0,o)|0)/(l|0)|0)+j|0;I[c+n|0]=(e|0)>=255?255:e;e=c+1|0;p=((Q(e-b|0,o)|0)/(l|0)|0)+j|0;I[e+n|0]=(p|0)>=255?255:p;c=c+2|0;if((i|0)!=(c|0)){continue}break}}c=h+2|0;if(h>>>0<10){continue}break}c=K[32972];K[c+80>>2]=232;K[c+72>>2]=256;K[c+76>>2]=238;if(!a){K[49848]=0}J[c+200>>1]=(Q(J[c+200>>1],105)|0)/100}function Od(a,b,c){var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;e=sa-288|0;sa=e;if((b|0)!=132848){Zc(132848,b,40)}d=a+228|0;if((d|0)!=(b|0)){Zc(d,b,40)}K[e+88>>2]=b;K[e+84>>2]=47;K[e+80>>2]=137584;d=e+96|0;Aa(d,84089,e+80|0);f=vb(d);d=K[a+688>>2];if(d){Ha(d);K[a+688>>2]=0}d=Cb(e+96|0,84577);a:{if(!((f|0)>0?d:0)){if(!c){K[e>>2]=e+96;Na(K[30450],84963,e)}c=1;if(!d){break a}_a(d);break a}c=Qa(f);K[a+688>>2]=c;if(!c){_a(d);c=3;break a}j=dd(c,f,d);_a(d);if(j>>>0<=1032){K[e+16>>2]=e+96;Na(K[30450],85164,e+16|0);c=2;break a}d=K[a+688>>2];c=K[d+4>>2];f=K[d>>2];if(!(!((f|0)!=1024|(c|0)<=0)&(c|0)<134217729)){K[e+40>>2]=c;K[e+36>>2]=f;K[e+32>>2]=e+96;Na(K[30450],85349,e+32|0);c=2;break a}d=c+d|0;K[a+684>>2]=d;l=Ea(a+5168|0,0,1024);Ea(a+7664|0,0,260);Ea(a+7924|0,255,256);Ea(a+4788|0,0,380);Ea(a+6192|0,0,512);c=L[d|0];b:{if((c|0)==7){break b}while(1){f=c&255;if((f|0)!=6){if(!f){break b}f=K[a+684>>2];K[e+72>>2]=c<<24>>24;K[e+64>>2]=132848;K[e+68>>2]=d-f;Na(K[30450],88950,e- -64|0)}else{c:{d:{e:{f:{g:{c=d+1|0;f=L[c|0];switch(f-18|0){case 0:break f;case 2:break g;default:break e}}c=(c&-4)+4|0;K[a+180>>2]=c;while(1){d=c;c=d+1|0;if(!Tc(d)){continue}break}while(1){f=L[d|0];c=d;d=d+1|0;if((f|0)!=7){continue}break}break c}c=d+3|0;d=I[d+2|0];d=((d|0)<65?191:-65)+d|0;if((d|0)>94){break d}K[((d<<2)+a|0)+4788>>2]=c;break d}h=Ba(c);c=(h+c|0)+1|0;h:{switch(h|0){case 1:K[((f<<2)+a|0)+5168>>2]=c;break d;case 0:K[l>>2]=c;break d;default:break h}}h=L[d+2|0];if((f|0)==1){K[((h<<2)+a|0)+6188>>2]=c;break d}d=K[a+7664>>2];g=a+f|0;k=g+7924|0;if(L[k|0]==255){I[k|0]=d}g=g+7668|0;I[g|0]=L[g|0]+1;g=(d<<2)+a|0;K[g+6704>>2]=c;K[a+7664>>2]=d+1;K[g+7184>>2]=f|h<<8}if(L[c|0]==7){break c}while(1){c=(Ba(c)+c|0)+1|0;if(L[c|0]!=7){continue}break}}d=c+1|0;c=L[d|0];continue}break}}d=K[a+688>>2]+8|0;while(1){c=i<<2;K[(c+a|0)+692>>2]=d;while(1){f=L[d|0];if(f){d=d+f|0;continue}break}d=d+1|0;K[((c|4)+a|0)+692>>2]=d;while(1){c=L[d|0];if(c){d=c+d|0;continue}break}d=d+1|0;i=i+2|0;if((i|0)!=1024){continue}break}c=0;a=K[a+324>>2];if((a|0)<=0|a>>>0<=j>>>0){break a}K[e+48>>2]=b;Na(K[30450],85519,e+48|0)}sa=e+288|0;return c}function Yb(a){var b=0,c=0,d=0;d=Ea(a+344|0,0,256);I[a+364|0]=1;I[a+356|0]=1;I[a+357|0]=1;I[a+358|0]=1;I[a+359|0]=1;I[a+360|0]=1;I[a+361|0]=1;I[a+362|0]=1;I[a+363|0]=1;I[a+348|0]=1;I[a+349|0]=1;I[a+350|0]=1;I[a+351|0]=1;I[a+352|0]=1;I[a+353|0]=1;I[a+354|0]=1;I[a+355|0]=1;I[a+431|0]=3;I[a+429|0]=3;I[a+430|0]=3;I[a+406|0]=3;I[a+407|0]=3;I[a+408|0]=3;I[a+409|0]=3;I[a+410|0]=3;I[a+411|0]=3;I[a+412|0]=3;I[a+413|0]=3;I[a+414|0]=3;I[a+415|0]=3;I[a+416|0]=3;I[a+417|0]=3;I[a+418|0]=3;I[a+419|0]=3;I[a+420|0]=3;I[a+421|0]=3;I[a+440|0]=3;I[a+441|0]=3;I[a+442|0]=3;I[a+443|0]=3;c=21;while(1){b=a+c|0;I[b+344|0]=L[b+344|0]|4;b=c+1|0;if((b|0)!=58){b=b+d|0;I[b|0]=L[b|0]|4;b=c+d|0;I[b+2|0]=L[b+2|0]|4;I[b+3|0]=L[b+3|0]|4;c=c+4|0;continue}break}I[a+346|0]=L[a+346|0]|4;I[a+347|0]=L[a+347|0]|4;I[a+432|0]=L[a+432|0]|4;I[a+433|0]=L[a+433|0]|4;I[a+434|0]=L[a+434|0]|4;I[a+435|0]=L[a+435|0]|4;I[a+436|0]=L[a+436|0]|4;I[a+437|0]=L[a+437|0]|4;I[a+438|0]=L[a+438|0]|4;I[a+439|0]=L[a+439|0]|4;I[a+467|0]=L[a+467|0]|4;I[a+468|0]=L[a+468|0]|4;I[a+470|0]=L[a+470|0]|4;I[a+471|0]=L[a+471|0]|4;I[a+348|0]=L[a+348|0]|64;I[a+349|0]=L[a+349|0]|64;I[a+350|0]=L[a+350|0]|64;I[a+351|0]=L[a+351|0]|64;I[a+352|0]=L[a+352|0]|64;I[a+353|0]=L[a+353|0]|64;I[a+354|0]=L[a+354|0]|64;I[a+355|0]=L[a+355|0]|64;I[a+356|0]=L[a+356|0]|64;I[a+357|0]=L[a+357|0]|64;I[a+358|0]=L[a+358|0]|64;I[a+359|0]=L[a+359|0]|64;I[a+360|0]=L[a+360|0]|64;I[a+361|0]=L[a+361|0]|64;I[a+362|0]=L[a+362|0]|64;I[a+363|0]=L[a+363|0]|64;I[a+364|0]=L[a+364|0]|64;I[a+406|0]=L[a+406|0]|64;I[a+407|0]=L[a+407|0]|64;I[a+408|0]=L[a+408|0]|64;I[a+409|0]=L[a+409|0]|64;I[a+410|0]=L[a+410|0]|64;I[a+411|0]=L[a+411|0]|64;I[a+412|0]=L[a+412|0]|64;I[a+413|0]=L[a+413|0]|64;I[a+414|0]=L[a+414|0]|64;I[a+415|0]=L[a+415|0]|64;I[a+416|0]=L[a+416|0]|64;I[a+417|0]=L[a+417|0]|64;I[a+418|0]=L[a+418|0]|64;I[a+419|0]=L[a+419|0]|64;I[a+420|0]=L[a+420|0]|64;I[a+440|0]=L[a+440|0]|64;I[a+441|0]=L[a+441|0]|64;I[a+429|0]=L[a+429|0]|64;I[a+430|0]=L[a+430|0]|64;I[a+431|0]=L[a+431|0]|64;I[a+442|0]=L[a+442|0]|64;I[a+443|0]=L[a+443|0]|64;K[a+40>>2]=1;K[a+204>>2]=K[a+600>>2]+77}function ce(a,b,c,d,e,f,g,h,i){var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;j=sa-128|0;sa=j;a:{b:{c:{if(!Gb(f,g,h,i,0,0,0,0)){break c}l=i&65535;n=i>>>16&32767;d:{e:{if((n|0)!=32767){k=4;if(n){break e}k=f|h|(g|l)?3:2;break d}k=!(f|h|(g|l))}}s=e>>>16|0;o=s&32767;if((o|0)==32767){break c}if(k){break b}}Ja(j+16|0,b,c,d,e,f,g,h,i);b=K[j+16>>2];d=K[j+20>>2];e=K[j+24>>2];c=K[j+28>>2];Ud(j,b,d,e,c,b,d,e,c);d=K[j+8>>2];e=K[j+12>>2];h=K[j>>2];i=K[j+4>>2];break a}k=d;p=e&2147483647;n=h;m=i&2147483647;if((Gb(b,c,k,p,f,g,h,m)|0)<=0){if(Gb(b,c,k,p,f,g,n,m)){h=b;i=c;break a}Ja(j+112|0,b,c,d,e,0,0,0,0);d=K[j+120>>2];e=K[j+124>>2];h=K[j+112>>2];i=K[j+116>>2];break a}q=i>>>16&32767;if(o){i=c;h=b}else{Ja(j+96|0,b,c,k,p,0,0,0,1081540608);k=K[j+104>>2];h=K[j+108>>2];p=h;o=(h>>>16|0)-120|0;i=K[j+100>>2];h=K[j+96>>2]}if(!q){Ja(j+80|0,f,g,n,m,0,0,0,1081540608);n=K[j+88>>2];f=K[j+92>>2];m=f;q=(f>>>16|0)-120|0;g=K[j+84>>2];f=K[j+80>>2]}r=n;t=m&65535|65536;p=p&65535|65536;if((o|0)>(q|0)){while(1){m=k-r|0;l=(g|0)==(i|0)&f>>>0>h>>>0|g>>>0>i>>>0;n=m-l|0;l=(p-((k>>>0<r>>>0)+t|0)|0)-(l>>>0>m>>>0)|0;f:{if((l|0)>0|(l|0)>=0){k=h;h=h-f|0;i=i-((f>>>0>k>>>0)+g|0)|0;if(!(h|n|(i|l))){Ja(j+32|0,b,c,d,e,0,0,0,0);d=K[j+40>>2];e=K[j+44>>2];h=K[j+32>>2];i=K[j+36>>2];break a}l=l<<1|n>>>31;k=n<<1|i>>>31;break f}l=p<<1|k>>>31;k=k<<1|i>>>31}p=l;l=i<<1|h>>>31;h=h<<1;i=l;o=o-1|0;if((o|0)>(q|0)){continue}break}o=q}m=k-r|0;l=(g|0)==(i|0)&f>>>0>h>>>0|g>>>0>i>>>0;n=m-l|0;l=(p-((k>>>0<r>>>0)+t|0)|0)-(l>>>0>m>>>0)|0;m=l;g:{if((l|0)<0){n=k;m=p;break g}k=h;h=h-f|0;i=i-((f>>>0>k>>>0)+g|0)|0;if(h|n|(i|m)){break g}Ja(j+48|0,b,c,d,e,0,0,0,0);d=K[j+56>>2];e=K[j+60>>2];h=K[j+48>>2];i=K[j+52>>2];break a}if((m|0)==65535|m>>>0<65535){while(1){b=i>>>31|0;o=o-1|0;p=i<<1|h>>>31;h=h<<1;i=p;c=b;b=m<<1|n>>>31;n=c|n<<1;m=b;if(b>>>0<65536){continue}break}}b=s&32768;if((o|0)<=0){Ja(j- -64|0,h,i,n,m&65535|(b|o+120)<<16,0,0,0,1065811968);d=K[j+72>>2];e=K[j+76>>2];h=K[j+64>>2];i=K[j+68>>2];break a}d=n;e=m&65535|(b|o)<<16}K[a>>2]=h;K[a+4>>2]=i;K[a+8>>2]=d;K[a+12>>2]=e;sa=j+128|0}function kd(a,b,c){var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;d=sa-1040|0;sa=d;f=re(a,589824,0);if((f|0)>=0){a:{e=Wd(1,2072);if(!e){_(f|0)|0;e=0;break a}K[e+8>>2]=f}}k=e;if(e){e=ne(k);b:{if(!e){break b}n=K[30450];m=(d+96|0)+b|0;while(1){f=K[50303];if((f|0)>=348){K[d+4>>2]=350;K[d>>2]=f+1;Na(n,91860,d);break b}c:{if(L[e+19|0]==46){break c}K[d+88>>2]=e+19;K[d+84>>2]=47;K[d+80>>2]=a;e=d+96|0;Aa(e,91924,d+80|0);e=vb(e);if((e|0)==-31){kd(d+96|0,b,c);break c}if((e|0)<=0){break c}l=Cb(d+96|0,85712);if(!l){break c}g=0;I[d+832|0]=0;I[d+752|0]=0;K[d+360>>2]=0;K[d+356>>2]=4;i=0;d:while(1){j=299-i|0;while(1){if(vc(d+912|0,120,l)){e=d+912|0;e:{if(L[d+912|0]!=35){e=Ba(d+912|0)-1|0;f:{if((e|0)<=0){break f}while(1){h=(d+912|0)+e|0;f=I[h|0];if(!((f|0)==32|f-9>>>0<5)){break f}I[h|0]=0;e=e-1|0;if((e|0)>0){continue}break}}e=ke(d+912|0);if(!e){break e}}I[e|0]=0}e=d+912|0;f=L[d+912|0];g:{if(!f){break g}while(1){if(Sa(f<<24>>24)){break g}e=e+1|0;f=L[e|0];if(f){continue}break}}I[e|0]=0;if(!L[d+912|0]){continue}e=e+1|0;h:{switch(ub(131904,d+912|0)-1|0){case 0:while(1){f=e;e=e+1|0;h=I[f|0];if((h|0)==32|h-9>>>0<5){continue}break};La(d+832|0,f,80);continue;case 1:I[d+672|0]=0;K[d+364>>2]=5;f=d+672|0;K[d+16>>2]=f;K[d+20>>2]=d+364;Ka(e,86237,d+16|0);f=Ba(f)+2|0;if(f>>>0>=j>>>0){continue}e=(d+368|0)+i|0;I[e|0]=K[d+364>>2];Ca(e+1|0,d+672|0);g=g+1|0;i=f+i|0;continue d;case 2:K[d+52>>2]=d+360;K[d+48>>2]=d+752;Ka(e,86237,d+48|0);if(!c){continue}K[d+32>>2]=m;Na(n,92042,d+32|0);continue;case 5:break h;default:continue}}K[d+64>>2]=d+356;Ka(e,87268,d- -64|0);continue}break}break}I[(d+368|0)+i|0]=0;f=ub(132112,d+752|0);if(!g){_a(l);break c}h=Ba(m)+i|0;g=Wd((Ba(d+832|0)+h|0)+28|0,1);e=i+1|0;j=Fa(g+24|0,d+368|0,e);K[g+4>>2]=j;e=Ca(e+j|0,m);K[g>>2]=e;K[g+8>>2]=e;if(L[d+832|0]){K[g>>2]=Ca((h+j|0)+2|0,d+832|0)}e=K[d+360>>2];I[g+14|0]=0;I[g+12|0]=f;I[g+13|0]=e;I[g+15|0]=K[d+356>>2];_a(l);e=K[50303];K[50303]=e+1;K[(e<<2)+201216>>2]=g}e=ne(k);if(e){continue}break}}Ae(K[k+8>>2]);Ha(k)}sa=d+1040|0}function xd(a,b){var c=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;e=sa-352|0;sa=e;a:{b:{if(a){break b}a=K[(b<<4)+136284>>2];if(a){break b}a=28;break a}if(L[a|0]!=47){K[e+12>>2]=a;K[e+4>>2]=47;K[e+8>>2]=47;K[e>>2]=137584;a=e+16|0;Aa(a,84114,e)}I[e+240|0]=0;c:{d:{c=Cb(a,84577);e:{if(!c){break e}if((se(c,20)|0)==-1){break c}f=Sc(c);d=Sc(c);h=Sc(c);if(!((f|0)!=65537|(d|0)!=K[50754])&(h|0)==d<<1){break d}_a(c);J[e+256>>1]=L[84864]|L[84865]<<8;a=L[84852]|L[84853]<<8|(L[84854]<<16|L[84855]<<24);K[e+240>>2]=L[84848]|L[84849]<<8|(L[84850]<<16|L[84851]<<24);K[e+244>>2]=a;a=L[84860]|L[84861]<<8|(L[84862]<<16|L[84863]<<24);K[e+248>>2]=L[84856]|L[84857]<<8|(L[84858]<<16|L[84859]<<24);K[e+252>>2]=a;f=sa-16|0;sa=f;f:{g:{h:{a=e+240|0;c=Ba(a);if(c>>>0>=6){h=(a+c|0)-6|0;if(!$a(h,84274,6)){break h}}K[56798]=28;break g}j=100;while(1){i=0;c=sa-16|0;sa=c;if(!L[227196]){I[227197]=fa();I[227196]=1}l=+ca();g=l/1e3;i:{if(S(g)<0x8000000000000000){k=S(g)>=1?~~(g>0?U(W(g*2.3283064365386963e-10),4294967295):X((g-+(~~g>>>0>>>0))*2.3283064365386963e-10))>>>0:0;d=~~g>>>0;break i}k=-2147483648;d=0}K[c>>2]=d;K[c+4>>2]=k;g=(l-(+(vg(d,k,1e3,0)>>>0)+ +(va|0)*4294967296))*1e3*1e3;j:{if(S(g)<2147483648){d=~~g;break j}d=-2147483648}K[c+8>>2]=d;d=h+(c>>>4|0)^Q(K[c+8>>2],65537);while(1){I[h+i|0]=(d&15|d<<1&32)+65;d=d>>>5|0;i=i+1|0;if((i|0)!=6){continue}break}sa=c+16|0;K[f>>2]=384;c=re(a,194,f);if((c|0)>=0){break f}j=j-1|0;if(K[56798]==20?j:0){continue}break}Fa(h,84274,6)}c=-1}sa=f+16|0;if((c|0)<0){break e}Ae(c)}c=Cb(a,84577);if(c){break d}a=zb(0,K[56798],a);break a}f=vb(a);if((f|0)<0){_a(c);a=zb(0,0-f|0,a);break a}if((se(c,0)|0)==-1){b=K[56798];_a(c);a=zb(0,b,a);break a}h=(b<<4)+136280|0;d=yb(K[h>>2],f);if(!d){_a(c);a=48;break a}if((dd(d,f,c)|0)!=(f|0)){b=K[56798];_a(c);if(L[e+240|0]){me(e+240|0)}Ha(d);a=zb(0,b,a);break a}_a(c);if(L[e+240|0]){me(e+240|0)}K[(b<<4)+136276>>2]=(L[d+40|0]|L[d+41|0]<<8|(L[d+42|0]<<16|L[d+43|0]<<24))/2;K[h>>2]=d;a=0;break a}b=K[56798];_a(c);a=zb(0,b,a)}sa=e+352|0;return a}function Md(a,b,c,d,e,f){var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0;I[c|0]=1;t=f&1;s=1;o=-1;p=-1;j=1;f=b;while(1){u=r-2|0;q=k;m=p;a:{b:{while(1){l=L[f|0];if(!l){p=m;k=q;break a}f=f+1|0;n=K[(l<<2)+144464>>2];if(!n){continue}c:{g=L[n+11|0];if((g|0)!=1){if(L[n+6|0]&16|(g|0)!=2){break c}k=c+j|0;I[k|0]=o;g=(o|0)<4|(m|0)>(o|0);if(!(!(L[n+4|0]&2)|(!t|(o|0)>=0))){I[k|0]=1}k=g?q:j;p=g?m:o;o=-1;j=j+1|0;break b}if(M[n+8>>1]){break c}g=0;i=j;d:{if((l|0)==8){while(1){l=g;i=i-1|0;if(K[e>>2]|(i|0)<=0){break d}h=c+i|0;n=I[h|0];if((n|0)>3){break d}g=l+1|0;if(n>>>0<2){continue}break}I[h|0]=4;q=(m|0)<4?i:q;m=(m|0)<=4?4:m;if(i>>>0<2){break d}i=(l^-1)+r|0;n=i&3;g=1;if(u-l>>>0>=3){l=i&-4;i=0;while(1){h=c+g|0;if(L[h|0]==4){I[h|0]=3}if(L[h+1|0]==4){I[h+1|0]=3}if(L[h+2|0]==4){I[h+2|0]=3}if(L[h+3|0]==4){I[h+3|0]=3}g=g+4|0;i=i+4|0;if((l|0)!=(i|0)){continue}break}}h=0;if(!n){break d}while(1){l=c+g|0;if(L[l|0]==4){I[l|0]=3}g=g+1|0;h=h+1|0;if((n|0)!=(h|0)){continue}break}break d}g=L[n+14|0];if(K[e>>2]?g>>>0>=4:0){break d}m=(g|0)<(m|0)?m:g;o=g}if(s){continue}break a}break}p=m;k=q;if((l|0)==20){I[c+j|0]=t?(o|0)<0?1:o:o;j=j+1|0}}I[b|0]=l;r=j-1|0;b=b+1|0;s=(j|0)<99;if(s){continue}}break}I[c+j|0]=1;I[b|0]=0;b=K[e>>2];e:{if((b|0)>0){p=4;if((b|0)>=(j|0)){K[e>>2]=r;b=r}I[b+c|0]=4;k=K[e>>2];break e}if((p|0)!=5){break e}p=4;if((j|0)<2){break e}f=1;b=j-1|0;m=b&1;if((j|0)!=2){q=b&-2;i=0;while(1){h=4;f:{g:{h:{g=f;b=g+c|0;switch(L[b|0]-4|0){case 1:break g;case 0:break h;default:break f}}h=L[a+14|0]&2?1:3;g=k}I[b|0]=h;k=g}h=4;i:{j:{k:{g=f+1|0;b=g+c|0;switch(L[b|0]-4|0){case 1:break j;case 0:break k;default:break i}}h=L[a+14|0]&2?1:3;g=k}I[b|0]=h;k=g}f=f+2|0;i=i+2|0;if((q|0)!=(i|0)){continue}break}}if(!m){break e}h=4;l:{m:{b=c+f|0;switch(L[b|0]-4|0){case 1:break l;case 0:break m;default:break e}}h=L[a+14|0]&2?1:3;f=k}I[b|0]=h;k=f}K[e>>2]=k;K[d>>2]=j;return p}function yb(a,b){var c=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;if(!a){return Qa(b)}if(b>>>0>=4294967232){K[56798]=48;return 0}g=b>>>0<11?16:b+11&-8;f=a-8|0;j=K[f+4>>2];e=j&-8;a:{if(!(j&3)){if(g>>>0<256){break a}if(e>>>0>=g+4>>>0){c=f;if(e-g>>>0<=K[57272]<<1>>>0){break a}}c=0;break a}h=e+f|0;b:{if(e>>>0>=g>>>0){d=e-g|0;if(d>>>0<16){break b}K[f+4>>2]=j&1|g|2;c=f+g|0;K[c+4>>2]=d|3;K[h+4>>2]=K[h+4>>2]|1;Xd(c,d);break b}if(K[57158]==(h|0)){e=e+K[57155]|0;if(e>>>0<=g>>>0){break a}K[f+4>>2]=j&1|g|2;d=f+g|0;c=e-g|0;K[d+4>>2]=c|1;K[57155]=c;K[57158]=d;break b}if(K[57157]==(h|0)){d=e+K[57154]|0;if(d>>>0<g>>>0){break a}c=d-g|0;c:{if(c>>>0>=16){K[f+4>>2]=j&1|g|2;e=f+g|0;K[e+4>>2]=c|1;d=d+f|0;K[d>>2]=c;K[d+4>>2]=K[d+4>>2]&-2;break c}K[f+4>>2]=d|j&1|2;c=d+f|0;K[c+4>>2]=K[c+4>>2]|1;c=0;e=0}K[57157]=e;K[57154]=c;break b}d=K[h+4>>2];if(d&2){break a}k=e+(d&-8)|0;if(k>>>0<g>>>0){break a}m=k-g|0;d:{if(d>>>0<=255){e=K[h+8>>2];c=d>>>3|0;d=K[h+12>>2];if((d|0)==(e|0)){K[57152]=K[57152]&yg(-2,c);break d}K[e+12>>2]=d;K[d+8>>2]=e;break d}l=K[h+24>>2];i=K[h+12>>2];e:{if((i|0)!=(h|0)){c=K[h+8>>2];K[c+12>>2]=i;K[i+8>>2]=c;break e}f:{e=h+20|0;c=K[e>>2];if(c){break f}e=h+16|0;c=K[e>>2];if(c){break f}i=0;break e}while(1){d=e;i=c;e=c+20|0;c=K[e>>2];if(c){continue}e=i+16|0;c=K[i+16>>2];if(c){continue}break}K[d>>2]=0}if(!l){break d}d=K[h+28>>2];c=(d<<2)+228912|0;g:{if(K[c>>2]==(h|0)){K[c>>2]=i;if(i){break g}K[57153]=K[57153]&yg(-2,d);break d}K[(K[l+16>>2]==(h|0)?16:20)+l>>2]=i;if(!i){break d}}K[i+24>>2]=l;c=K[h+16>>2];if(c){K[i+16>>2]=c;K[c+24>>2]=i}c=K[h+20>>2];if(!c){break d}K[i+20>>2]=c;K[c+24>>2]=i}if(m>>>0<=15){K[f+4>>2]=j&1|k|2;c=f+k|0;K[c+4>>2]=K[c+4>>2]|1;break b}K[f+4>>2]=j&1|g|2;d=f+g|0;K[d+4>>2]=m|3;c=f+k|0;K[c+4>>2]=K[c+4>>2]|1;Xd(d,m)}c=f}if(c){return c+8|0}f=Qa(b);if(!f){return 0}c=K[a-4>>2];c=(c&3?-4:-8)+(c&-8)|0;Fa(f,a,b>>>0>c>>>0?c:b);Ha(a);return f}function Ce(){var a=0,b=0,c=0,d=0;c=fb(12);K[c>>2]=22050;d=fb(432);b=d;K[b+4>>2]=0;K[b+8>>2]=0;K[b>>2]=132304;K[b+32>>2]=0;K[b+12>>2]=0;K[b+16>>2]=0;K[b+20>>2]=0;K[b+24>>2]=0;Ea(b+40|0,0,376);K[b+420>>2]=0;K[b+424>>2]=-1;I[b+416|0]=1;a=Ea(fb(408),0,408);K[b+28>>2]=a;I[a+8|0]=1;K[c+4>>2]=b;a=fb(1096);K[a+8>>2]=22050;K[a+4>>2]=22050;K[a>>2]=132352;K[a+64>>2]=22050;K[a+56>>2]=0;K[a+60>>2]=0;K[a+32>>2]=0;K[a+36>>2]=0;K[a+24>>2]=22050;K[a+16>>2]=0;K[a+20>>2]=0;K[a+40>>2]=0;K[a+44>>2]=0;I[a+48|0]=0;K[a+128>>2]=0;K[a+132>>2]=0;J[a+96>>1]=0;K[a+72>>2]=22050;K[a+136>>2]=0;K[a+140>>2]=0;J[a+168>>1]=0;K[a+144>>2]=22050;K[a+200>>2]=0;K[a+204>>2]=0;K[a+208>>2]=0;K[a+212>>2]=0;K[a+216>>2]=22050;J[a+240>>1]=0;K[a+280>>2]=0;K[a+284>>2]=0;K[a+272>>2]=0;K[a+276>>2]=0;K[a+288>>2]=22050;J[a+312>>1]=0;K[a+344>>2]=0;K[a+348>>2]=0;K[a+352>>2]=0;K[a+356>>2]=0;K[a+360>>2]=22050;J[a+384>>1]=0;K[a+416>>2]=0;K[a+420>>2]=0;K[a+424>>2]=0;K[a+428>>2]=0;K[a+432>>2]=22050;J[a+456>>1]=0;K[a+488>>2]=0;K[a+492>>2]=0;K[a+496>>2]=0;K[a+500>>2]=0;K[a+504>>2]=22050;J[a+528>>1]=1;K[a+560>>2]=0;K[a+564>>2]=0;K[a+568>>2]=0;K[a+572>>2]=0;J[a+600>>1]=0;K[a+576>>2]=22050;K[a+640>>2]=0;K[a+644>>2]=0;K[a+632>>2]=0;K[a+636>>2]=0;J[a+680>>1]=0;K[a+656>>2]=22050;K[a+648>>2]=22050;K[a+720>>2]=0;K[a+724>>2]=0;K[a+712>>2]=0;K[a+716>>2]=0;J[a+752>>1]=0;K[a+728>>2]=22050;K[a+792>>2]=0;K[a+796>>2]=0;K[a+784>>2]=0;K[a+788>>2]=0;J[a+824>>1]=0;K[a+800>>2]=22050;K[a+864>>2]=0;K[a+868>>2]=0;K[a+856>>2]=0;K[a+860>>2]=0;K[a+872>>2]=22050;J[a+896>>1]=0;K[a+936>>2]=0;K[a+940>>2]=0;K[a+928>>2]=0;K[a+932>>2]=0;J[a+968>>1]=0;K[a+944>>2]=22050;K[a+1008>>2]=0;K[a+1012>>2]=0;K[a+1e3>>2]=0;K[a+1004>>2]=0;J[a+1040>>1]=0;K[a+1016>>2]=22050;K[a+1088>>2]=0;b=a+1080|0;K[b>>2]=0;K[b+4>>2]=0;b=a+1072|0;K[b>>2]=0;K[b+4>>2]=0;K[c+8>>2]=a;wa[K[K[a>>2]+4>>2]](a,d);return c}function eg(a,b,c){a=a|0;b=b|0;c=c|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0;if(!K[a+1088>>2]){return 0}a:{if(!b){break a}j=a+648|0;i=a- -64|0;while(1){d=K[a+1088>>2];d=wa[K[K[d>>2]+4>>2]](d)|0;if(!d){break a}e=ve(P[a+32>>3]+P[d+16>>3]/+K[a+24>>2]);P[a+32>>3]=e;e=pc(e*6.283185307179586);e=ve(P[a+16>>3]+P[d>>3]*(e*.06*P[d+8>>3]+1)/+K[a+8>>2]);P[a+16>>3]=e;h=vg(K[56848],K[56849],1284865837,1481765933);f=va;h=h+1|0;f=h?f:f+1|0;K[56848]=h;K[56849]=f;g=P[a+40>>3]*.75+ +(f>>>1|0)/2147483647;P[a+40>>3]=g;k=P[d+24>>3];f=e>=P[d+32>>3];I[a+48|0]=f;m=k;k=g*.2;g=m*k;e=P[d+352>>3]*(k*P[d+48>>3]+P[d+40>>3]*(e+e+-1+(f?g:g*.01)))*.5;g=ib(i+512|0,ib(i+440|0,e,P[d+104>>3],P[d+168>>3]),P[d+112>>3],P[d+176>>3]);g=ib(i+8|0,ib(i+80|0,ib(i+152|0,ib(i+224|0,ib(i+296|0,ib(i+368|0,g==g?(g-e)*P[d+184>>3]+e:e,P[d+96>>3],P[d+160>>3]),P[d+88>>3],P[d+152>>3]),P[d+80>>3],P[d+144>>3]),P[d+72>>3],P[d+136>>3]),P[d+64>>3],P[d+128>>3]),P[d+56>>3],P[d+120>>3]);h=vg(K[56848],K[56849],1284865837,1481765933);f=va;h=h+1|0;f=h?f:f+1|0;K[56848]=h;K[56849]=f;e=P[a+56>>3]*.75+ +(f>>>1|0)/2147483647;P[a+56>>3]=e;f=(l<<1)+c|0;e=P[d+352>>3]*(P[d+192>>3]*(e*.3))*.5;k=ib(j+8|0,e,P[d+200>>3],P[d+248>>3]);n=P[d+296>>3];o=ib(j+80|0,e,P[d+208>>3],P[d+256>>3]);p=P[d+304>>3];q=ib(j+152|0,e,P[d+216>>3],P[d+264>>3]);r=P[d+312>>3];s=ib(j+224|0,e,P[d+224>>3],P[d+272>>3]);t=P[d+320>>3];u=ib(j+296|0,e,P[d+232>>3],P[d+280>>3]);v=P[d+328>>3];m=g;g=(ib(j+368|0,e,P[d+240>>3],P[d+288>>3])-e)*P[d+336>>3]+(v*(u-e)+(t*(s-e)+(r*(q-e)+(p*(o-e)+(n*(k-e)+0)))));e=(m+(e==e?(e-g)*P[d+344>>3]+g:g))*P[d+360>>3]*4e3;b:{if(S(e)<2147483648){d=~~e;break b}d=-2147483648}d=(d|0)>=32e3?32e3:d;J[f>>1]=(d|0)<=-32e3?-32e3:d;l=l+1|0;if((l|0)!=(b|0)){continue}break}l=b}return(b>>>0>l>>>0?l:b)|0}function Ke(a,b,c){var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;a:{l=K[50759];if(!l){i=1;break a}d=K[50980];e=Q(d,80)+222176|0;e=(K[e+12>>2]+K[e>>2]|0)/(a|0)|0;k=((Q(K[50754],19)|0)/40<<16)/(a|0)|0;e=(e|0)<(k|0)?e:k;i=(e|0)>=399?399:e;if((i|0)>=0){Ea(b,0,(i<<2)+4|0);d=K[50980]}if((d|0)>=0){m=K[50801];while(1){f=Q(g,80)+222176|0;b:{if(!K[f+4>>2]){break b}h=K[f>>2];if(!h){break b}n=h+K[f+12>>2]|0;d=((h-K[f+8>>2]|0)/(a|0)|0)+1|0;e=(d|0)<=1?1:d;d=Q(e,a);if((h|0)>(d|0)){while(1){j=(e<<2)+b|0;K[j>>2]=K[j>>2]+Q(K[f+4>>2],L[((h-d|0)/(K[f+8>>2]>>8)|0)+m|0]);e=e+1|0;d=a+d|0;if((h|0)>(d|0)){continue}break}}if((d|0)>=(n|0)){break b}while(1){j=(e<<2)+b|0;K[j>>2]=K[j>>2]+Q(K[f+4>>2],L[((d-h|0)/(K[f+12>>2]>>8)|0)+m|0]);e=e+1|0;d=a+d|0;if((n|0)>(d|0)){continue}break}}g=g+1|0;if((g|0)<=K[50980]){continue}break}}e=1;f=65536e3/(a|0)|0;c:{if((f|0)<=0){break c}d=Q(K[55565],10);if((d|0)<=0){break c}f=(d|0)/(f|0)|0;while(1){h=(e<<2)+b|0;K[h>>2]=K[h>>2]+d;e=e+1|0;d=d-f|0;if((d|0)>0){continue}break}}if((g|0)<=8){while(1){d=g<<2;e=d+203216|0;f=Q(g,80)+222176|0;h=K[f+4>>2]>>14;K[e>>2]=(Q(Q(h,h),5)|0)/2;d:{if(c){d=K[d+203264>>2];break d}h=d+203264|0;d=K[f>>2]/(a|0)|0;K[h>>2]=d}if((d|0)>=(k|0)){K[e>>2]=0}g=g+1|0;if((g|0)!=9){continue}break}}e=0;if((i|0)>=0){d=0;while(1){g=(d<<2)+b|0;f=K[g>>2]>>15;f=Q(f,f)>>8;K[g>>2]=f;if((e|0)<=524287999){K[g>>2]=Q(f,L[((e>>19)+l|0)+344|0])>>13}e=a+e|0;g=(d|0)!=(i|0);d=d+1|0;if(g){continue}break}}K[b+4>>2]=(Q(K[b+4>>2],L[203300]?6:10)|0)/8;if(!(c&1)){break a}a=K[50826];d=1;while(1){c=d<<2;K[c+203312>>2]=K[b+c>>2]-K[a+c>>2]>>3;c=d+1|0;if((c|0)==30){break a}c=c<<2;K[c+203312>>2]=K[b+c>>2]-K[a+c>>2]>>3;d=d+2|0;continue}}return i}function bf(a,b,c,d){var e=0,f=0,g=0;e=sa-176|0;sa=e;I[a|0]=0;J[e+80>>1]=24320;K[e+104>>2]=0;K[e+108>>2]=0;f=e+80|2;I[(Pa(c,f)+e|0)+82|0]=0;a:{b:{if(!d){d=e+80|1;K[e+12>>2]=d;c:{if(Wa(b,e+12|0,e+16|0,e+104|0,0,0)){break c}K[e+12>>2]=f;if(Wa(b,e+12|0,e+16|0,e+104|0,0,0)){break c}I[e+81|0]=32;jb(b,f,e+16|0,60,0,0,0)}c=L[e+16|0];if(c?(c|0)!=21:0){break b}d:{if(K[b+212>>2]!=25966){Ec(85719,188772,189296);I[e+81|0]=95;K[e+12>>2]=d;if(!Wa(K[47193],e+12|0,e+16|0,e+104|0,0,0)){K[e+12>>2]=f;Wa(K[47193],e+12|0,e+16|0,e+104|0,0,0)}if(L[e+16|0]){break d}ab(K[K[32972]+60>>2]);c=L[e+16|0]}if(c&255){break b}b=L[87124]|L[87125]<<8|(L[87126]<<16|L[87127]<<24);c=L[87120]|L[87121]<<8|(L[87122]<<16|L[87123]<<24);I[a|0]=c;I[a+1|0]=c>>>8;I[a+2|0]=c>>>16;I[a+3|0]=c>>>24;I[a+4|0]=b;I[a+5|0]=b>>>8;I[a+6|0]=b>>>16;I[a+7|0]=b>>>24;I[a+16|0]=L[87136];b=L[87132]|L[87133]<<8|(L[87134]<<16|L[87135]<<24);c=L[87128]|L[87129]<<8|(L[87130]<<16|L[87131]<<24);I[a+8|0]=c;I[a+9|0]=c>>>8;I[a+10|0]=c>>>16;I[a+11|0]=c>>>24;I[a+12|0]=b;I[a+13|0]=b>>>8;I[a+14|0]=b>>>16;I[a+15|0]=b>>>24;break a}d=e+16|0;f=e+104|0;c=sa-112|0;sa=c;g=K[47193];e:{if(!g){kb(b,d,f,-1,0);b=c+48|0;Ab(d,b);K[c>>2]=b;Aa(a,85451,c);break e}kb(g,d,f,-1,0);f=d;d=c+48|0;Ab(f,d);b=K[b+212>>2];I[c+43|0]=b>>>24;f=c+43|0;g=f+(b>>>0>16777215)|0;I[g|0]=b>>>16;g=g+((b&16711680)!=0)|0;I[g|0]=b>>>8;g=g+((b&65280)!=0)|0;I[g|0]=b;I[g+((b&255)!=0)|0]=0;K[c+16>>2]=85719;K[c+24>>2]=f;K[c+20>>2]=d;Aa(a,85662,c+16|0)}sa=c+112|0;ab(K[K[32972]+60>>2]);break a}K[e+12>>2]=f;Wa(b,e+12|0,e+16|0,e+104|0,0,0);if(!L[e+16|0]){break a}}c=b;b=e+16|0;kb(c,b,e+104|0,-1,0);c=b;b=e+112|0;Ab(c,b);K[e>>2]=b;Aa(a,85451,e)}sa=e+176|0;return a}function Zb(a,b){var c=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0;c=sa-112|0;sa=c;K[c+72>>2]=-1;d=c- -64|0;K[d>>2]=-1;K[d+4>>2]=-1;K[c+56>>2]=-1;K[c+60>>2]=-1;K[c+48>>2]=-1;K[c+52>>2]=-1;K[c+40>>2]=-1;K[c+44>>2]=-1;K[c+32>>2]=-1;K[c+36>>2]=-1;K[c+24>>2]=-1;K[c+28>>2]=-1;K[c+16>>2]=-1;K[c+20>>2]=-1;if((b|0)>0){f=K[c+72>>2];g=K[c+68>>2];h=K[c+64>>2];i=K[c+60>>2];j=K[c+56>>2];k=K[c+52>>2];l=K[c+48>>2];m=K[c+44>>2];n=K[c+40>>2];o=K[c+36>>2];p=K[c+32>>2];q=K[c+28>>2];r=K[c+24>>2];s=K[c+20>>2];t=K[c+16>>2];while(1){e=f;d=(u<<6)+134912|0;f=K[d+60>>2];f=(f|0)<0?e:f;e=g;g=K[d+56>>2];g=(g|0)<0?e:g;e=h;h=K[d+52>>2];h=(h|0)<0?e:h;e=i;i=K[d+48>>2];i=(i|0)<0?e:i;e=j;j=K[d+44>>2];j=(j|0)<0?e:j;e=k;k=K[d+40>>2];k=(k|0)<0?e:k;e=l;l=K[d+36>>2];l=(l|0)<0?e:l;e=m;m=K[d+32>>2];m=(m|0)<0?e:m;e=n;n=K[d+28>>2];n=(n|0)<0?e:n;e=o;o=K[d+24>>2];o=(o|0)<0?e:o;e=p;p=K[d+20>>2];p=(p|0)<0?e:p;e=q;q=K[d+16>>2];q=(q|0)<0?e:q;e=r;r=K[d+12>>2];r=(r|0)<0?e:r;e=s;s=K[d+8>>2];s=(s|0)<0?e:s;d=K[d+4>>2];t=(d|0)<0?t:d;u=u+1|0;if((u|0)!=(b|0)){continue}break}K[c+72>>2]=f;K[c+68>>2]=g;K[c+64>>2]=h;K[c+60>>2]=i;K[c+56>>2]=j;K[c+52>>2]=k;K[c+48>>2]=l;K[c+44>>2]=m;K[c+40>>2]=n;K[c+36>>2]=o;K[c+32>>2]=p;K[c+28>>2]=q;K[c+24>>2]=r;K[c+20>>2]=s;K[c+16>>2]=t}b=0;while(1){f=b<<2;d=K[f+(c+16|0)>>2];f=f+134848|0;if((d|0)!=K[f>>2]){I[c+80|0]=0;a:{b:{switch(b-1|0){case 4:K[47201]=d-1;break a;case 5:K[47200]=d;break a;case 0:case 1:case 2:case 3:case 11:break b;default:break a}}K[c+4>>2]=d;K[c>>2]=1;K[c+8>>2]=I[b+102812|0];Aa(c+80|0,91942,c)}K[f>>2]=d;d=c+80|0;Ca(K[a>>2]+189424|0,d);K[a>>2]=K[a>>2]+Ba(d)}b=b+1|0;if((b|0)!=15){continue}break}sa=c+112|0}function md(a){var b=0,c=0,d=0,e=0,f=0,g=0,h=0;b=17;K[a+328>>2]=17;K[a+224>>2]=0;K[a+216>>2]=1105;K[a+220>>2]=1072;K[a+600>>2]=1056;K[a+8180>>2]=105296;d=Ea(a+344|0,0,256);I[a+393|0]=1;I[a+365|0]=1;I[a+360|0]=1;I[a+545|0]=1;I[a+529|0]=1;I[a+391|0]=1;I[a+379|0]=1;I[a+374|0]=1;I[a+489|0]=1;I[a+487|0]=1;I[a+398|0]=1;I[a+387|0]=1;I[a+388|0]=2;I[a+389|0]=1;I[a+390|0]=1;I[a+385|0]=2;I[a+383|0]=2;I[a+368|0]=1;I[a+369|0]=2;c=104224;while(1){b=b+d|0;I[b|0]=L[b|0]|4;b=d+L[c+1|0]|0;I[b|0]=L[b|0]|4;b=d+L[c+2|0]|0;I[b|0]=L[b|0]|4;c=c+3|0;b=L[c|0];if((c|0)!=104251){continue}break}I[a+386|0]=L[a+386|0]|8;I[a+382|0]=L[a+382|0]|8;I[a+384|0]=L[a+384|0]|8;I[a+369|0]=L[a+369|0]|16;I[a+370|0]=L[a+370|0]|16;I[a+371|0]=L[a+371|0]|16;c=L[a+361|0];d=L[a+362|0];b=L[a+363|0];e=L[a+364|0];f=L[a+366|0];g=L[a+367|0];I[a+372|0]=L[a+372|0]|16;I[a+373|0]=L[a+373|0]|16;I[a+375|0]=L[a+375|0]|16;I[a+376|0]=L[a+376|0]|16;I[a+377|0]=L[a+377|0]|16;I[a+378|0]=L[a+378|0]|16;I[a+380|0]=L[a+380|0]|16;I[a+381|0]=L[a+381|0]|16;I[a+383|0]=L[a+383|0]|16;I[a+385|0]=L[a+385|0]|16;h=L[a+388|0];I[a+367|0]=g|48;I[a+366|0]=f|40;I[a+364|0]=e|48;I[a+363|0]=b|48;I[a+362|0]=d|48;I[a+361|0]=c|48;I[a+388|0]=h|80;c=L[a+390|0];d=L[a+391|0];b=L[a+393|0];I[a+360|0]=L[a+360|0]|128;e=L[a+365|0];I[a+393|0]=b|192;I[a+365|0]=e|128;I[a+368|0]=L[a+368|0]|128;I[a+374|0]=L[a+374|0]|128;I[a+379|0]=L[a+379|0]|128;I[a+387|0]=L[a+387|0]|128;b=L[a+389|0];I[a+391|0]=d|192;I[a+390|0]=c|192;I[a+389|0]=b|128;I[a+529|0]=L[a+529|0]|128;I[a+545|0]=L[a+545|0]|128;I[a+489|0]=L[a+489|0]|128;I[a+487|0]=L[a+487|0]|128;I[a+398|0]=L[a+398|0]|128}function Wa(a,b,c,d,e,f){var g=0,h=0,i=0,j=0,k=0,l=0,m=0;i=sa-192|0;sa=i;l=K[b>>2];g=l;a:{b:{while(1){j=I[g|0];h=1;c:{if((j|0)>=0){break c}h=2;if(j>>>0<4294967264){break c}h=j>>>0<4294967280?3:4}j=h+g|0;if(!(L[j|0]!=32|L[j+1|0]!=46)){if(k-160>>>0<4294967135){break b}m=i+32|0;Fa(m+k|0,g,h);h=h+k|0;I[h+m|0]=46;g=j+3|0;k=h+1|0;continue}break}if(!k){break b}h=0;while(1){j=h;h=h+1|0;if(L[g+j|0]&223){continue}break}m=j+k|0;if(m+1>>>0>160){break b}h=i+32|0;Fa(h+k|0,g,j);I[h+m|0]=0;if(!Pc(a,h,g,c,d,e,f)){break b}K[d>>2]=K[d>>2]|128;K[33264]=k;a=1;break a}g=0;while(1){d:{h=l;l=h+1|0;h=L[h|0];if(!(h&223)){h=g;break d}if(!(!g|(h|0)!=46|I[(g+i|0)+31|0]-48>>>0>=10)){h=g;break d}I[(i+32|0)+g|0]=h;h=159;g=g+1|0;if((g|0)!=159){continue}}break}g=i+32|0;I[g+h|0]=0;g=Pc(a,g,l,c,d,e,f);e:{if(L[d+3|0]&8){j=a+268|0;if(!Oa(c,j)){j=K[a+288>>2]+1|0;K[a+288>>2]=j;if((j|0)<4){break e}I[c|0]=0;break e}La(j,c,20);K[a+288>>2]=1;break e}K[a+288>>2]=0}f:{if(!g){g=0;if(L[d+5|0]&8){g=i+32|L[i+32|0]==95;j=Ga(i+28|0,g);Id(a,K[i+28>>2],c);g=g+j|0}if(!(h>>>0<2|g)){I[c|0]=0;g:{if(e&16){g=(h+i|0)+31|0;if(L[g|0]==101){break g}}if(!(e&4096)){break f}h=(i+32|0)+h|0;g=h-1|0;if(L[g|0]!=L[h-2|0]){break f}}I[g|0]=0;g=Pc(a,i+32|0,l,c,d,e,f)}if(!g){break f}}k=K[d>>2];if(L[a+172|0]){k=k^536870912;K[d>>2]=k}a=1;if(!(k&536870912)){break a}if(!(e&2)){break f}J[66448]=8192;K[i+16>>2]=c;Aa(132898,87470,i+16|0);a=K[b>>2];K[b>>2]=132898;if(!(L[188788]&8)){break f}b=i+32|0;d=a;a=g-a|0;Fa(b,d,a);I[a+b|0]=0;K[i+4>>2]=132898;a=K[47195];K[i>>2]=b;Na(a,87652,i)}I[c|0]=0;a=0}sa=i+192|0;return a}function jd(a,b){var c=0,d=0,e=0;c=a&31;a:{b:{c:{a=a&96;if((a|0)==96){a=-1}else{if((a|0)!=64){break c}a=1}if(c>>>0>=15){break a}b=K[(c<<2)+203136>>2]+Q(a,b)|0;break b}if(c>>>0>=15){break a}}d=c<<2;a=K[d+105616>>2];K[d+203136>>2]=(b|0)>=0?(a|0)>(b|0)?b:a:0}d:{e:{f:{g:{h:{switch(c-1|0){case 5:a=K[50759];if(!a){break e}K[54728]=K[50982];b=K[50979];c=K[50978];Ea(205184,0,11e3);K[51293]=0;d=K[50789];e=(d|0)>0;c=e?130:(c|0)>=5499?5499:c;b=c?e?d:(b|0)>=100?100:b:0;K[50755]=b;c=(Q(c,K[50754])|0)/1e3|0;K[51292]=c;K[54729]=(b|0)>20?c<<1:b?c:0;K[33037]=(Q(500-b|0,(Q(L[K[50797]+105596|0],(Q(K[50787],55)|0)/100|0)|0)/16|0)|0)/500;break g;case 0:break h;case 2:case 12:break d;case 4:break f;default:break e}}a=K[50759];if(!a){break e}}b=256;c=K[50785];c=(c|0)>=101?101:c;if((c|0)>=51){b=(((Q(c,25)-1250&65535)>>>0)/50|0)+256|0}J[a+164>>1]=(Q(J[a+236>>1],b)|0)/256;J[a+166>>1]=(Q(J[a+238>>1],b)|0)/256;J[a+168>>1]=(Q(J[a+240>>1],b)|0)/256;J[a+170>>1]=(Q(J[a+242>>1],b)|0)/256;J[a+172>>1]=(Q(J[a+244>>1],b)|0)/256;J[a+174>>1]=(Q(J[a+246>>1],b)|0)/256;a=K[50790];J[102e3]=(Q(J[102036],Q(a,-3)+256|0)|0)/256;J[101999]=(Q(J[102035],Q(a,-6)+256|0)|0)/256;return}if(!K[50759]){break e}K[54728]=K[50982];a=K[50979];b=K[50978];Ea(205184,0,11e3);K[51293]=0;c=K[50789];d=(c|0)>0;b=d?130:(b|0)>=5499?5499:b;a=b?d?c:(a|0)>=100?100:a:0;K[50755]=a;b=(Q(b,K[50754])|0)/1e3|0;K[51292]=b;K[54729]=(a|0)>20?b<<1:a?b:0;K[33037]=(Q(500-a|0,(Q(L[K[50797]+105596|0],(Q(K[50787],55)|0)/100|0)|0)/16|0)|0)/500}return}K[33037]=(Q(L[K[50797]+105596|0],(Q(K[50787],55)|0)/100|0)|0)/16}function Rc(a,b,c){var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;if(c){K[c>>2]=0}d=I[a|0];a:{b:{if((d|0)<0){break b}while(1){f=d&255;if((f|0)==32|f-9>>>0<5){a=a+1|0;d=I[a|0];if((d|0)>=0){continue}break b}break}if(!(d&255)){break a}}while(1){i=d&255;d=i;if((d|0)==32|d-9>>>0<5){break a}c:{d:{if((i|0)!=124){break d}f=a+1|0;d=L[f|0];if((d|0)==124){break d}a=f;break c}e:{l=K[36115];if((l|0)>=2){d=1;f=-1;j=0;while(1){k=K[(d<<2)+144464>>2];f:{if(!k|L[k+11|0]==15){break f}h=K[k>>2];g:{h:{if(i>>>0>=33){m=0;g=0;i:{if((h&255)!=(i|0)){break i}g=1;e=L[a+1|0];if(e>>>0<33|(e|0)!=(h>>>8&255)){break i}g=2;e=L[a+2|0];if(e>>>0<33|(e|0)!=(h>>>16&255)){break i}e=L[a+3|0];e=e>>>0>32&(e|0)==(h>>>24|0);g=e?4:3;m=0-e|0}if((f|0)>=(g|0)){break f}e=4;if(!(m&1)){break h}break g}g=0;if((f|0)>=0){break f}}e=g;if(h>>>(e<<3)&255){break f}}j=L[k+10|0];f=e}d=d+1|0;if((l|0)!=(d|0)){continue}break}if(j){break e}}if(c){Ga(c,a)}I[b|0]=0;return}I[b|0]=j;a=((f|0)<=1?1:f)+a|0;f=b+1|0;b=f;j:{if((j|0)!=21){break j}e=L[a|0];k:{if((e|0)==32|e-9>>>0<5){d=f;break k}d=f;if(!e){break k}while(1){I[d|0]=xb(e);d=d+1|0;a=a+1|0;e=L[a|0];if((e|0)==32|e-9>>>0<5){break k}if(e){continue}break}}I[d|0]=0;if(!e){b=d;if(Oa(f,85593)){break j}I[f|0]=0;return}I[d|0]=124;b=d+1|0}d=L[a|0]}if(d&255){continue}break}}I[b|0]=0}function ae(a,b){var c=0,d=0,e=0,f=0,g=0;a:{b:{c:{d:{e:{c=K[a+4>>2];f:{if((c|0)!=K[a+104>>2]){K[a+4>>2]=c+1;c=L[c|0];break f}c=Ia(a)}switch(c-43|0){case 0:case 2:break e;default:break d}}f=(c|0)==45;g=!b;c=K[a+4>>2];g:{if((c|0)!=K[a+104>>2]){K[a+4>>2]=c+1;c=L[c|0];break g}c=Ia(a)}b=c-58|0;if(g|b>>>0>4294967285){break c}if(K[a+116>>2]<0){break b}K[a+4>>2]=K[a+4>>2]-1;break b}b=c-58|0}if(b>>>0<4294967286){break b}b=c-48|0;if(b>>>0<10){while(1){d=Q(d,10)+c|0;d=d-48|0;e=(d|0)<214748364;b=K[a+4>>2];h:{if((b|0)!=K[a+104>>2]){K[a+4>>2]=b+1;c=L[b|0];break h}c=Ia(a)}b=c-48|0;if(e&b>>>0<=9){continue}break}e=d>>31}i:{if(b>>>0>=10){break i}while(1){d=vg(d,e,10,0);b=d+c|0;c=va;c=b>>>0<d>>>0?c+1|0:c;d=b-48|0;e=c-(b>>>0<48)|0;b=K[a+4>>2];j:{if((b|0)!=K[a+104>>2]){K[a+4>>2]=b+1;c=L[b|0];break j}c=Ia(a)}b=c-48|0;if(b>>>0>9){break i}if(d>>>0<2061584302&(e|0)<=21474836|(e|0)<21474836){continue}break}}if(b>>>0<10){while(1){b=K[a+4>>2];k:{if((b|0)!=K[a+104>>2]){K[a+4>>2]=b+1;b=L[b|0];break k}b=Ia(a)}if(b-48>>>0<10){continue}break}}b=K[a+116>>2];if((b|0)>0|(b|0)>=0){K[a+4>>2]=K[a+4>>2]-1}a=d;d=f?0-a|0:a;e=f?0-(((a|0)!=0)+e|0)|0:e;break a}e=-2147483648;if(K[a+116>>2]<0){break a}K[a+4>>2]=K[a+4>>2]-1;va=-2147483648;return 0}va=e;return d}function jg(a){a=a|0;var b=0,c=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0;c=K[a+420>>2]+1|0;K[a+420>>2]=c;b=K[a+32>>2];a:{if(b){h=K[b+4>>2];if(c>>>0>h>>>0){c=K[a+28>>2];if(c){Ha(c);b=K[a+32>>2]}K[a+32>>2]=0;K[a+28>>2]=b;break a}f=a+40|0;g=b+16|0;i=K[a+28>>2]+16|0;j=+(c>>>0)/+(h>>>0);b=0;while(1){c=b<<3;d=P[c+g>>3];e=P[c+i>>3];P[c+f>>3]=d==d?(d-e)*j+e:e;c=b|1;if((c|0)==47){break a}c=c<<3;d=P[c+g>>3];e=P[c+i>>3];P[c+f>>3]=d==d?(d-e)*j+e:e;b=b+2|0;continue}}b=K[a+28>>2];if(c>>>0>N[b>>2]){f=K[a+24>>2];if(f){I[a+416|0]=0;g=K[a+8>>2];c=K[a+20>>2];b=K[K[g+(c>>>8&16777212)>>2]+((c&1023)<<2)>>2];K[a+32>>2]=b;K[a+24>>2]=f-1;c=c+1|0;K[a+20>>2]=c;if(c>>>0>=2048){Ha(K[g>>2]);K[a+8>>2]=K[a+8>>2]+4;K[a+20>>2]=K[a+20>>2]-1024;b=K[a+32>>2]}b:{if(L[b+8|0]){Fa(b+16|0,K[a+28>>2]+16|0,376);b=K[a+32>>2];K[b+368>>2]=0;K[b+372>>2]=0;d=P[a+40>>3];K[b+392>>2]=0;K[b+396>>2]=0;P[b+16>>3]=d;break b}c=K[a+28>>2];if(!L[c+8|0]){break b}Fa(c+16|0,b+16|0,376);b=K[a+28>>2];K[b+368>>2]=0;K[b+372>>2]=0;b=K[a+32>>2];if(!b){break a}}c=K[b+400>>2];if((c|0)!=-1){K[a+424>>2]=c}K[a+420>>2]=0;P[b+16>>3]=P[b+392>>3]*+N[b+4>>2]+P[b+16>>3];break a}I[a+416|0]=1;break a}d=P[b+392>>3]+P[a+40>>3];P[a+40>>3]=d;P[b+16>>3]=d}return(L[a+416|0]?0:a+40|0)|0}function Hc(a){var b=0,c=0,d=0,e=0;K[36432]=110;K[36433]=100;K[36434]=450;K[36430]=5;b=K[((a|0)==2?32:8)+203136>>2];d=K[32972];c=K[d+84>>2];if((c|0)>0){b=(Q(b,c)|0)/100|0}c=(b|0)>=359?359:b;b=(b|0)>=450?450:b;c=(b|0)>399?6:(b|0)>379?7:L[((c|0)<=80?80:c)+101856|0];a:{if(!(a&1)){break a}K[32526]=(Q(c,K[d+72>>2])|0)/256;K[32527]=(Q(c,K[d+76>>2])|0)/256;K[32528]=(Q(c,K[d+80>>2])|0)/256;if(c>>>0>7){break a}e=c-1|0;K[32528]=e;K[32526]=c;K[32527]=e}if(a&2){a=K[d+72>>2];b:{c:{d:{e:{f:{g:{h:{i:{j:{if((b|0)>=351){d=b-350|0;K[36432]=85-(((d&255)>>>0)/3|0)&255;d=60-(d>>>3|0)|0;break j}if((b|0)<251){break i}d=b-250|0;K[36432]=110-(d>>>2|0);d=110-(d>>>1|0)|0}K[36433]=d;a=(Q(a,c)|0)/256|0;K[36431]=((Q(a,150)|0)/128|0)+110;if(b>>>0<=349){break h}c=b-350|0;K[36431]=L[c+102224|0];if(b>>>0<390){break f}K[36434]=((b+112<<24>>24)/-2<<24>>24)+450;if(b>>>0<441){break g}K[36434]=860-b;a=12;break c}a=(Q(a,c)|0)/256|0;K[36431]=(b|0)>=170?((Q(a,150)|0)/128|0)+110|0:((a<<7)/130|0)+128|0}a=(a<<8)/115|0;break c}a=12;if(b>>>0>430){break c}a=13;if(b>>>0<=400){break e}break c}a=(a<<8)/115|0;K[36428]=a;if(b>>>0<375){break d}}a=14;break c}if((b|0)<351){break b}a=L[c+102336|0]}K[36428]=a}K[36429]=(a|0)<=16?16:a}}function Ge(a,b,c){var d=0,e=0,f=0,g=0;d=+K[50767]*.000244140625;P[c>>3]=d;P[c+40>>3]=+K[a+112>>2]*.015625;P[c+48>>3]=+K[a+276>>2]*.015625;P[c+56>>3]=+(Q(J[a+166>>1],J[b+4>>1])|0)*.00390625+ +J[a+220>>1];P[c+64>>3]=+(Q(J[a+168>>1],J[b+6>>1])|0)*.00390625+ +J[a+222>>1];P[c+72>>3]=+(Q(J[a+170>>1],J[b+8>>1])|0)*.00390625+ +J[a+224>>1];P[c+80>>3]=+(Q(J[a+172>>1],J[b+10>>1])|0)*.00390625+ +J[a+226>>1];P[c+88>>3]=+(Q(J[a+174>>1],J[b+12>>1])|0)*.00390625+ +J[a+228>>1];e=J[a+230>>1];f=J[a+176>>1];g=J[b+14>>1];K[c+112>>2]=0;K[c+116>>2]=1080623104;K[c+104>>2]=0;K[c+108>>2]=1081032704;P[c+96>>3]=+(Q(f,g)|0)*.00390625+ +(e|0);a:{if(L[b+40|0]){K[c+184>>2]=0;K[c+188>>2]=1072693248;P[c+104>>3]=L[b+40|0]<<1;break a}K[c+184>>2]=0;K[c+188>>2]=0}P[c+120>>3]=+J[a+202>>1]*.00390625*+(L[b+35|0]<<1);P[c+128>>3]=+J[a+204>>1]*.00390625*+(L[b+36|0]<<1);P[c+136>>3]=+J[a+206>>1]*.00390625*+(L[b+37|0]<<1);b=L[b+38|0];a=J[a+208>>1];K[c+176>>2]=0;K[c+180>>2]=1079574528;K[c+160>>2]=0;K[c+164>>2]=1083129856;K[c+152>>2]=0;K[c+156>>2]=1083129856;K[c+352>>2]=0;K[c+356>>2]=1072693248;K[c+168>>2]=0;K[c+172>>2]=1079574528;P[c+144>>3]=+(a|0)*.00390625*+(b<<1);a=K[50779];P[c+368>>3]=d;P[c+360>>3]=+(a|0)/100*3}function Ic(a){var b=0,c=0;Rb(a,Bb(a));a:{b:{c:{d:{e:{f:{g:{h:{i:{a=va&-1048576;j:{if((a|0)<268435455|(a|0)<=268435455){k:{l:{if((a|0)<33554431|(a|0)<=33554431){if((a|0)<8388607|(a|0)<=8388607){c=524328;if(!b&(a|0)==-2147483648){break a}if(b|(a|0)!=-2143289344){break b}return 557096}if(!b&(a|0)==8388608){break l}if(b|(a|0)!=16777216){break b}return 524358}if((a|0)>71303167){break k}if(!b&(a|0)==33554432){break c}if(b|(a|0)!=67108864){break b}}return 266270}if(!b&(a|0)==71303168){break j}if(!b&(a|0)==134217728){break d}if(b|(a|0)!=138412032){break b}return 294942}if((a|0)<542113791|(a|0)<=542113791){if((a|0)<536870911|(a|0)<=536870911){if(!b&(a|0)==268435456){break e}if(b|(a|0)!=272629760){break b}return 299028}if(!b&(a|0)==536870912){break g}if(!b&(a|0)==538968064){break f}if(b|(a|0)!=541065216){break b}return 569389}if((a|0)<1075838975|(a|0)<=1075838975){if(!b&(a|0)==542113792){break j}if(b|(a|0)!=1073741824){break b}return 532520}if(!b&(a|0)==1075838976){break h}if(!b&(a|0)==1077936128){break i}if(b|(a|0)!=1078984704){break b}}return 299038}return 565288}return 1581096}return 536621}return 1585197}return 266260}return 262174}return 2396190}c=16384}return c}function Fc(a,b,c,d,e,f){var g=0,h=0,i=0,j=0,k=0,l=0;k=a&8388607;h=K[34456];a=k+h|0;g=L[a|0]|L[a+1|0]<<8;if(!g){return}i=L[a+2|0];j=!i;a=K[36434]<<j;a:{if((c|0)<=0){c=g;break a}c=(Q(K[50754],c)|0)/1e3<<j;l=(Q(c,a)|0)/(g|0)|0;a=(a|0)<(l|0)?l:a}e=(e|0)>0?(Q(c,e)|0)/256|0:c;c=(Q(e,K[36431])|0)/256|0;c=(d&4)>>>2|0?(c|0)>(e|0)?e:c:c;c=(a|0)<(c|0)?c:a;if(!i){g=g>>>1|0;c=(c|0)/2|0}b:{if((f|0)<0){break b}d=k+4|0;c:{if(b&256){a=K[50758];K[36439]=a;b=(a<<4)+216192|0;K[b>>2]=7;K[b+8>>2]=d+h;K[b+4>>2]=g<<16|c;f=i|f<<8;break c}a=K[50758];K[36439]=a;a=(a<<4)+216192|0;K[a>>2]=6;f=i|f<<8;K[a+12>>2]=f;K[a+8>>2]=d+h;h=a;b=g>>>2|0;a=Q(b,3);e=(c|0)>(g|0);K[h+4>>2]=e?a:c;h=K[50758]+1|0;K[50758]=(h|0)<=169?h:0;c=e?c-a|0:0;if((a|0)<(c|0)){e=b<<1;i=d+(i?b:e)|0;while(1){b=K[50758];K[36439]=b;b=(b<<4)+216192|0;K[b>>2]=6;K[b+4>>2]=e;K[b+12>>2]=f;K[b+8>>2]=i+K[34456];b=K[50758]+1|0;K[50758]=(b|0)<=169?b:0;c=c-e|0;if((a|0)<(c|0)){continue}break}}if((c|0)<=0){break b}a=K[50758];K[36439]=a;b=(a<<4)+216192|0;K[b>>2]=6;K[b+4>>2]=c;K[b+8>>2]=K[34456]+(d+(g-c<<j)|0)}K[((a<<4)+216192|0)+12>>2]=f;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0}}function Fa(a,b,c){var d=0,e=0,f=0;if(c>>>0>=512){ga(a|0,b|0,c|0);return a}e=a+c|0;a:{if(!((a^b)&3)){b:{if(!(a&3)){c=a;break b}if(!c){c=a;break b}c=a;while(1){I[c|0]=L[b|0];b=b+1|0;c=c+1|0;if(!(c&3)){break b}if(c>>>0<e>>>0){continue}break}}d=e&-4;c:{if(d>>>0<64){break c}f=d+-64|0;if(f>>>0<c>>>0){break c}while(1){K[c>>2]=K[b>>2];K[c+4>>2]=K[b+4>>2];K[c+8>>2]=K[b+8>>2];K[c+12>>2]=K[b+12>>2];K[c+16>>2]=K[b+16>>2];K[c+20>>2]=K[b+20>>2];K[c+24>>2]=K[b+24>>2];K[c+28>>2]=K[b+28>>2];K[c+32>>2]=K[b+32>>2];K[c+36>>2]=K[b+36>>2];K[c+40>>2]=K[b+40>>2];K[c+44>>2]=K[b+44>>2];K[c+48>>2]=K[b+48>>2];K[c+52>>2]=K[b+52>>2];K[c+56>>2]=K[b+56>>2];K[c+60>>2]=K[b+60>>2];b=b- -64|0;c=c- -64|0;if(f>>>0>=c>>>0){continue}break}}if(c>>>0>=d>>>0){break a}while(1){K[c>>2]=K[b>>2];b=b+4|0;c=c+4|0;if(d>>>0>c>>>0){continue}break}break a}if(e>>>0<4){c=a;break a}d=e-4|0;if(d>>>0<a>>>0){c=a;break a}c=a;while(1){I[c|0]=L[b|0];I[c+1|0]=L[b+1|0];I[c+2|0]=L[b+2|0];I[c+3|0]=L[b+3|0];b=b+4|0;c=c+4|0;if(d>>>0>=c>>>0){continue}break}}if(c>>>0<e>>>0){while(1){I[c|0]=L[b|0];b=b+1|0;c=c+1|0;if((e|0)!=(c|0)){continue}break}}return a}function nb(a){var b=0,c=0,d=0,e=0,f=0,g=0,h=0,i=0;C(+a);b=x(1)|0;x(0)|0;a:{b:{b=b>>>20&2047;d=b-969|0;if(d>>>0<63){i=b;break b}if((d|0)<0){return a+1}if(b>>>0<1033){break b}C(+a);d=x(1)|0;c=0;if(!(x(0)|0)&(d|0)==-1048576){break a}if(b>>>0>=2047){return a+1}if((d|0)<0){b=sa-16|0;P[b+8>>3]=12882297539194267e-247;return P[b+8>>3]*12882297539194267e-247}b=sa-16|0;P[b+8>>3]=3105036184601418e216;return P[b+8>>3]*3105036184601418e216}c=P[14409];e=P[14408]*a+c;c=e-c;a=c*P[14411]+(c*P[14410]+a);c=a*a;f=c*c*(a*P[14415]+P[14414]);c=c*(a*P[14413]+P[14412]);C(+e);x(1)|0;h=x(0)|0;d=h<<4&2032;a=f+(c+(P[d+115376>>3]+a));d=d+115384|0;g=K[d>>2];b=K[d+4>>2];d=g;g=0;d=d+g|0;b=(h<<13)+b|0;b=d>>>0<g>>>0?b+1|0:b;if(!i){c:{if(!(h&-2147483648)){z(0,d|0);z(1,b-1058013184|0);c=+B();a=(c*a+c)*5486124068793689e288;break c}z(0,d|0);z(1,b+1071644672|0);c=+B();e=c*a;a=e+c;if(a<1){b=sa-16|0;K[b+8>>2]=0;K[b+12>>2]=1048576;P[b+8>>3]=P[b+8>>3]*22250738585072014e-324;f=a+1;a=f+(e+(c-a)+(a+(1-f)))+-1;a=a==0?0:a}a=a*22250738585072014e-324}return a}z(0,d|0);z(1,b|0);c=+B();c=c*a+c}return c}function Cb(a,b){var c=0,d=0,e=0,f=0,g=0;f=sa-16|0;sa=f;a:{b:{if(!mb(84270,I[b|0])){K[56798]=28;break b}d=2;if(!mb(b,43)){d=L[b|0]!=114}d=mb(b,120)?d|128:d;d=mb(b,101)?d|524288:d;e=d;g=d|64;d=L[b|0];e=(d|0)==114?e:g;e=(d|0)==119?e|512:e;K[f>>2]=438;K[f+4>>2]=0;a=ba(-100,a|0,((d|0)==97?e|1024:e)|32768,f|0)|0;if(a>>>0>=4294963201){K[56798]=0-a;a=-1}if((a|0)<0){break a}d=sa-32|0;sa=d;c:{d:{e:{if(!mb(84270,I[b|0])){K[56798]=28;break e}c=Qa(1176);if(c){break d}}b=0;break c}Ea(c,0,144);if(!mb(b,43)){K[c>>2]=L[b|0]==114?8:4}f:{if(L[b|0]!=97){b=K[c>>2];break f}b=aa(a|0,3,0)|0;if(!(b&1024)){b=b|1024;K[d+16>>2]=b;K[d+20>>2]=b>>31;aa(a|0,4,d+16|0)|0}b=K[c>>2]|128;K[c>>2]=b}K[c+80>>2]=-1;K[c+48>>2]=1024;K[c+60>>2]=a;K[c+44>>2]=c+152;g:{if(b&8){break g}K[d>>2]=d+24;K[d+4>>2]=0;if(ea(a|0,21523,d|0)|0){break g}K[c+80>>2]=10}K[c+40>>2]=10;K[c+36>>2]=11;K[c+32>>2]=12;K[c+12>>2]=13;if(!L[227205]){K[c+76>>2]=-1}K[c+56>>2]=K[56816];b=K[56816];if(b){K[b+52>>2]=c}K[56816]=c;b=c}sa=d+32|0;c=b;if(c){break a}_(a|0)|0}c=0}sa=f+16|0;return c}function oe(a,b,c){var d=0,e=0,f=0,g=0,h=0,i=0;g=a;d=sa-208|0;sa=d;K[d+8>>2]=1;K[d+12>>2]=0;h=b<<2;a:{if(!h){break a}K[d+16>>2]=4;K[d+20>>2]=4;b=4;e=4;f=2;while(1){a=b;b=(e+4|0)+b|0;K[(d+16|0)+(f<<2)>>2]=b;f=f+1|0;e=a;if(b>>>0<h>>>0){continue}break}a=(g+h|0)-4|0;b:{if(a>>>0<=g>>>0){f=0;b=1;a=0;break b}f=1;b=1;while(1){c:{if((f&3)==3){ad(g,c,b,d+16|0);tc(d+8|0,2);b=b+2|0;break c}e=b-1|0;d:{if(N[(d+16|0)+(e<<2)>>2]>=a-g>>>0){sc(g,c,d+8|0,b,0,d+16|0);break d}ad(g,c,b,d+16|0)}if((b|0)==1){rc(d+8|0,1);b=0;break c}rc(d+8|0,e);b=1}e=K[d+8>>2];f=e|1;K[d+8>>2]=f;g=g+4|0;if(a>>>0>g>>>0){continue}break}f=e>>>0>1;a=K[d+12>>2]!=0}sc(g,c,d+8|0,b,0,d+16|0);if(!(f|(b|0)!=1|a)){break a}while(1){e:{if((b|0)<=1){e=d+8|0;a=qe(e);tc(e,a);f=K[d+8>>2];a=a+b|0;break e}e=d+8|0;rc(e,2);K[d+8>>2]=K[d+8>>2]^7;tc(e,1);i=g-4|0;h=d+16|0;a=b-2|0;sc(i-K[h+(a<<2)>>2]|0,c,e,b-1|0,1,h);rc(e,1);f=K[d+8>>2]|1;K[d+8>>2]=f;sc(i,c,e,a,1,h)}b=a;g=g-4|0;if(K[d+12>>2]|((b|0)!=1|(f|0)!=1)){continue}break}}sa=d+208|0}function Wc(a,b,c,d){var e=0,f=0,g=0,h=0;g=sa-32|0;sa=g;e=d&2147483647;h=e;f=e-1006698496|0;e=e-1140785152|0;a:{if((f|0)==(e|0)&0|e>>>0>f>>>0){e=c<<4|b>>>28;c=d<<4|c>>>28;b=b&268435455;if((b|0)==134217728&(a|0)!=0|b>>>0>134217728){f=c+1073741824|0;e=e+1|0;f=e?f:f+1|0;break a}f=c+1073741824|0;if(a|(b|0)!=134217728){break a}a=e&1;e=a+e|0;f=a>>>0>e>>>0?f+1|0:f;break a}if(!(!c&(h|0)==2147418112?!(a|b):h>>>0<2147418112)){a=d<<4|c>>>28;e=c<<4|b>>>28;f=a&524287|2146959360;break a}e=0;f=2146435072;if(h>>>0>1140785151){break a}f=0;h=h>>>16|0;if(h>>>0<15249){break a}e=d&65535|65536;Xa(g+16|0,a,b,c,e,h-15233|0);Fb(g,a,b,c,e,15361-h|0);b=K[g+8>>2];e=b<<4;b=K[g+12>>2]<<4|b>>>28;c=K[g>>2];f=K[g+4>>2];h=f;e=f>>>28|e;f=b;a=h&268435455;b=c|(K[g+16>>2]|K[g+24>>2]|(K[g+20>>2]|K[g+28>>2]))!=0;if((a|0)==134217728&(b|0)!=0|a>>>0>134217728){e=e+1|0;f=e?f:f+1|0;break a}if(b|(a|0)!=134217728){break a}a=e;e=e+(e&1)|0;f=a>>>0>e>>>0?f+1|0:f}sa=g+32|0;z(0,e|0);z(1,d&-2147483648|f);return+B()}function ve(a){var b=0,c=0,d=0,e=0,f=0,g=0,h=0;C(+a);f=x(1)|0;d=x(0)|0;e=f>>>20&2047;if((e|0)==2047){a=a*1;return a/a}c=d<<1;b=f<<1|d>>>31;if(!c&(b|0)==2145386496|b>>>0<2145386496){return!c&(b|0)==2145386496?a*0:a}a:{if(!e){e=0;c=d<<12;b=f<<12|d>>>20;if((b|0)>0|(b|0)>=0){while(1){e=e-1|0;b=b<<1|c>>>31;c=c<<1;if((b|0)>0|(b|0)>=0){continue}break}}b=1-e|0;c=b&31;if((b&63)>>>0>=32){b=d<<c;d=0}else{b=(1<<c)-1&d>>>32-c|f<<c;d=d<<c}break a}b=f&1048575|1048576}c=d;if((e|0)>1023){while(1){b:{d=b+-1048576|0;if((d|0)<0){break b}b=d;if(b|c){break b}return a*0}b=b<<1|c>>>31;c=c<<1;e=e-1|0;if((e|0)>1023){continue}break}e=1023}c:{d=b+-1048576|0;if((d|0)<0){break c}b=d;if(b|c){break c}return a*0}if((b|0)==1048575|b>>>0<1048575){while(1){e=e-1|0;d=b>>>0<524288;b=b<<1|c>>>31;c=c<<1;if(d){continue}break}}g=f&-2147483648;if((e|0)>0){b=b+-1048576|e<<20}else{d=1-e|0;f=b;e=c;c=d&31;if((d&63)>>>0>=32){b=0;c=f>>>c|0}else{b=f>>>c|0;c=((1<<c)-1&f)<<32-c|e>>>c}}z(0,c|h);z(1,b|g);return+B()}function Eb(a,b,c,d,e){var f=0,g=0,h=0;g=sa-160|0;sa=g;a:{b:{c:{d:{f=L[b+10|0];switch(f-15|0){case 6:break c;case 0:break d;default:break b}}I[a|0]=0;break a}K[g>>2]=Q(L[c+7|0],44)+137856;Aa(a,86002,g);a=Ba(a)+a|0;break a}e:{if(!d){break e}I[g+140|0]=0;f:{if(!c){ud(f,g+8|0);break f}bb(0,0,c,g+8|0,0)}c=g+140|0;f=L[g+140|0];g:{if(!f){break g}if((f|0)==32){I[a|0]=0;break a}f=f<<24>>24;if(f&224){break g}if(e){K[e>>2]=f}c=g+141|0}e=Ba(c);if((e|0)<=0){break e}a=Ca(a,c)+e|0;I[a|0]=0;break a}e=0;h:{f=K[b>>2];c=f&255;if(!c|(c|0)==47){break h}i:{if(d){h=f&255;if((h|0)==95){break h}j:{k:{if((h|0)==35){h=3;if(L[b+11|0]!=2){break k}break h}h=c-32|0;if(h>>>0>95){break j}}c=M[(h<<1)+93952>>1]}e=Pa(c,a);break i}I[a|0]=f;e=1}while(1){f=f>>8;c=f&255;if(!c|(c|0)==47){break h}if(d){if((c|0)==35&L[b+11|0]==2){break h}if(c-48>>>0<10){continue}h=c-32|0;if(h>>>0<=95){c=M[(h<<1)+93952>>1]}e=Pa(c,a+e|0)+e|0}else{I[a+e|0]=f;e=e+1|0}continue}}a=a+e|0;I[a|0]=0}sa=g+160|0;return a}function hc(a){var b=0,c=0;c=a;b=131280;a:{b:{c:{if((a|0)<=1023){break c}b=131300;if(a>>>0<1328){break c}b=131320;if(a>>>0<1424){break c}b=131340;if(a>>>0<1536){break c}b=131360;if(a>>>0<1792){break c}b=131380;if(a>>>0<1872){break c}b=131400;if(a>>>0<2432){break c}b=131420;if(a>>>0<2560){break c}b=131440;if(a>>>0<2688){break c}b=131460;if(a>>>0<2816){break c}b=131480;if(a>>>0<2944){break c}b=131500;if(a>>>0<3072){break c}b=131520;if(a>>>0<3200){break c}b=131540;if(a>>>0<3328){break c}b=131560;if(a>>>0<3456){break c}b=131580;if(a>>>0<3584){break c}b=131600;if(a>>>0<3712){break c}b=131620;if(a>>>0<3840){break c}b=131640;if(a>>>0<4096){break c}b=131660;if(a>>>0<4256){break c}b=131680;if(a>>>0<4352){break c}b=131700;if(a>>>0<4608){break c}b=131720;if(a>>>0<5024){break c}b=131740;if(a>>>0<10496){break c}b=131760;if(a>>>0<12544){break c}b=131780;if(a>>>0<40960){break c}if(a>>>0>=55296){break b}b=131800}a=b;if((c|0)>=M[a+8>>1]){break a}}a=0}return a}function Id(a,b,c){var d=0,e=0,f=0,g=0,h=0;d=sa-208|0;sa=d;I[d+80|0]=0;e=b-224|0;a:{b:{if(e>>>0<=158){b=(e<<1)+101072|0;break b}b=b-592|0;if(b>>>0>88){break a}b=(b<<1)+101392|0}b=M[b>>1];if(!b){break a}g=b<<16>>16;e=b&63;c:{if(e>>>0>37){h=e+59|0;break c}h=J[(e<<1)+101584>>1]}e=b>>>6|0;d:{if((g|0)<0){e=(e&63)+59|0;b=b>>>12&7;break d}f=e&31;if(!f){break a}e=0;b=b>>>11&15}f=Da(a,K[(f<<3)+129920>>2],d+112|0);if(!f){break a}if(!Hd(a,h,d+176|0)){break a}e:{if(!b){break e}if(!(Da(a,K[(b<<3)+129920>>2],d+80|0)&4096)){break e}b=Ca(c,d+80|0);c=Ba(b);I[d+80|0]=0;c=b+c|0}if(e){b=a;a=d+144|0;Hd(b,e,a);K[d+68>>2]=d+80;K[d- -64>>2]=a;K[d+60>>2]=6;K[d+52>>2]=23;K[d+56>>2]=d+176;K[d+48>>2]=d+112;Aa(c,84101,d+48|0);break a}if((g|0)<0){Ca(c,d+176|0);break a}if(K[a+144>>2]&1|f&4096){K[d+36>>2]=23;K[d+40>>2]=6;K[d+44>>2]=d+176;K[d+32>>2]=d+112;Aa(c,84430,d+32|0);break a}K[d+16>>2]=23;K[d+8>>2]=23;K[d>>2]=4;K[d+12>>2]=d+112;K[d+4>>2]=d+176;Aa(c,84802,d)}sa=d+208|0}function Ie(){id();K[55928]=0;K[55926]=0;K[55927]=0;K[55924]=0;K[56244]=0;K[56245]=0;K[56246]=0;K[56247]=0;K[56260]=0;K[56261]=0;K[56262]=0;K[56263]=0;K[56276]=0;K[56277]=0;K[56278]=0;K[56279]=0;K[55974]=0;K[55975]=0;K[55972]=0;K[55973]=0;K[55988]=0;K[55989]=0;K[55990]=0;K[55991]=0;K[56004]=0;K[56005]=0;K[56006]=0;K[56007]=0;K[56020]=0;K[56021]=0;K[56022]=0;K[56023]=0;K[56036]=0;K[56037]=0;K[56038]=0;K[56039]=0;K[56052]=0;K[56053]=0;K[56054]=0;K[56055]=0;K[56068]=0;K[56069]=0;K[56070]=0;K[56071]=0;K[56086]=0;K[56087]=0;K[56084]=0;K[56085]=0;K[56102]=0;K[56103]=0;K[56100]=0;K[56101]=0;K[56118]=0;K[56119]=0;K[56116]=0;K[56117]=0;K[56134]=0;K[56135]=0;K[56132]=0;K[56133]=0;K[56150]=0;K[56151]=0;K[56148]=0;K[56149]=0;K[56166]=0;K[56167]=0;K[56164]=0;K[56165]=0;K[56182]=0;K[56183]=0;K[56180]=0;K[56181]=0;K[56198]=0;K[56199]=0;K[56196]=0;K[56197]=0;K[56214]=0;K[56215]=0;K[56212]=0;K[56213]=0;K[56230]=0;K[56231]=0;K[56228]=0;K[56229]=0}function De(a,b){var c=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;a:{f=K[a+4>>2];b:{if((f|0)!=K[a>>2]){c=f;break b}g=K[a+8>>2];c=K[a+12>>2];if(g>>>0<c>>>0){e=((c-g>>2)+1|0)/2<<2;c=e+g|0;if((f|0)!=(g|0)){d=g-f|0;c=c-d|0;zc(c,f,d);f=K[a+8>>2]}K[a+4>>2]=c;K[a+8>>2]=e+f;break b}d=(c|0)==(f|0)?1:c-f>>1;if(d>>>0>=1073741824){break a}c=d<<2;i=fb(c);k=i+c|0;c=(d+3&-4)+i|0;h=c;c:{if((f|0)==(g|0)){break c}g=g-f|0;l=g&-4;e=c;d=f;j=g-4|0;g=(j>>>2|0)+1&7;if(g){h=0;while(1){K[e>>2]=K[d>>2];d=d+4|0;e=e+4|0;h=h+1|0;if((g|0)!=(h|0)){continue}break}}h=c+l|0;if(j>>>0<28){break c}while(1){K[e>>2]=K[d>>2];K[e+4>>2]=K[d+4>>2];K[e+8>>2]=K[d+8>>2];K[e+12>>2]=K[d+12>>2];K[e+16>>2]=K[d+16>>2];K[e+20>>2]=K[d+20>>2];K[e+24>>2]=K[d+24>>2];K[e+28>>2]=K[d+28>>2];d=d+32|0;e=e+32|0;if((h|0)!=(e|0)){continue}break}}K[a+12>>2]=k;K[a+8>>2]=h;K[a+4>>2]=c;K[a>>2]=i;if(!f){break b}Ha(f);c=K[a+4>>2]}K[c-4>>2]=K[b>>2];K[a+4>>2]=K[a+4>>2]-4;return}hd();D()}function tg(a,b,c){var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;a:{b:{c:{d:{e:{f:{g:{h:{i:{if(b){if(!c){break i}break h}b=a;a=(a>>>0)/(c>>>0)|0;ta=b-Q(a,c)|0;ua=0;va=0;return a}if(!a){break g}break f}d=c-1|0;if(!(d&c)){break e}g=(T(c)+33|0)-T(b)|0;f=0-g|0;break c}ta=0;a=(b>>>0)/0|0;ua=b-Q(a,0)|0;va=0;return a}d=32-T(b)|0;if(d>>>0<31){break d}break b}ta=a&d;ua=0;if((c|0)==1){break a}d=ug(c);c=d&31;if((d&63)>>>0>=32){a=b>>>c|0}else{e=b>>>c|0;a=((1<<c)-1&b)<<32-c|a>>>c}va=e;return a}g=d+1|0;f=63-d|0}e=g&63;d=e&31;if(e>>>0>=32){e=0;h=b>>>d|0}else{e=b>>>d|0;h=((1<<d)-1&b)<<32-d|a>>>d}f=f&63;d=f&31;if(f>>>0>=32){b=a<<d;a=0}else{b=(1<<d)-1&a>>>32-d|b<<d;a=a<<d}if(g){d=c-1|0;k=(d|0)==-1?-1:0;while(1){i=e<<1|h>>>31;e=h<<1|b>>>31;f=k-(i+(e>>>0>d>>>0)|0)>>31;j=c&f;h=e-j|0;e=i-(e>>>0<j>>>0)|0;b=b<<1|a>>>31;a=l|a<<1;i=f&1;l=i;g=g-1|0;if(g){continue}break}}ta=h;ua=e;va=b<<1|a>>>31;return i|a<<1}ta=a;ua=b;a=0;b=0}va=b;return a}function Ee(a,b){var c=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;a:{c=K[a+8>>2];b:{if((c|0)!=K[a+12>>2]){e=c;break b}d=K[a+4>>2];g=K[a>>2];if(d>>>0>g>>>0){f=((d-g>>2)+1|0)/-2<<2;c=c-d|0;e=zc(f+d|0,d,c)+c|0;K[a+8>>2]=e;K[a+4>>2]=f+K[a+4>>2];break b}f=(c|0)==(g|0)?1:c-g>>1;if(f>>>0>=1073741824){break a}e=f<<2;h=fb(e);k=h+e|0;f=(f&-4)+h|0;e=f;c:{if((c|0)==(d|0)){break c}c=c-d|0;l=c&-4;i=c-4|0;j=(i>>>2|0)+1&7;d:{if(!j){c=f;break d}e=0;c=f;while(1){K[c>>2]=K[d>>2];d=d+4|0;c=c+4|0;e=e+1|0;if((j|0)!=(e|0)){continue}break}}e=f+l|0;if(i>>>0<28){break c}while(1){K[c>>2]=K[d>>2];K[c+4>>2]=K[d+4>>2];K[c+8>>2]=K[d+8>>2];K[c+12>>2]=K[d+12>>2];K[c+16>>2]=K[d+16>>2];K[c+20>>2]=K[d+20>>2];K[c+24>>2]=K[d+24>>2];K[c+28>>2]=K[d+28>>2];d=d+32|0;c=c+32|0;if((e|0)!=(c|0)){continue}break}}K[a+12>>2]=k;K[a+8>>2]=e;K[a+4>>2]=f;K[a>>2]=h;if(!g){break b}Ha(g);e=K[a+8>>2]}K[e>>2]=K[b>>2];K[a+8>>2]=K[a+8>>2]+4;return}hd();D()}function Dc(a,b){var c=0,d=0,e=0,f=0,g=0,h=0;e=189088;d=sa-320|0;sa=d;K[d+312>>2]=0;g=Ca(d+112|0,189088);f=Md(a,g,d,d+316|0,d+312|0,0);c=K[d+316>>2];a:{if((b|0)<=3){if((c|0)<2){break a}b=c-1|0;f=b&3;a=1;if(c-2>>>0>=3){h=b&-4;b=0;while(1){c=a+d|0;if(I[c|0]>=4){I[c|0]=3}c=a+d|0;if(I[c+1|0]>=4){I[c+1|0]=3}if(I[c+2|0]>=4){I[c+2|0]=3}if(I[c+3|0]>=4){I[c+3|0]=3}a=a+4|0;b=b+4|0;if((h|0)!=(b|0)){continue}break}}if(!f){break a}b=0;while(1){c=a+d|0;if(I[c|0]>=4){I[c|0]=3}a=a+1|0;b=b+1|0;if((f|0)!=(b|0)){continue}break}break a}a=1;if((c|0)<=1){break a}while(1){h=a+d|0;if((f|0)>I[h|0]){a=a+1|0;if((c|0)!=(a|0)){continue}break a}break}I[h|0]=b}a=L[g|0];if(a){b=1;while(1){c=K[((a&255)<<2)+144464>>2];if(!(L[c+11|0]!=2|L[c+6|0]&16)){c=I[b+d|0];f=c&255;if(!((c|0)<2?f:0)){I[e|0]=L[f+94151|0];e=e+1|0;a=L[g|0]}b=b+1|0}I[e|0]=a;e=e+1|0;g=g+1|0;a=L[g|0];if(a){continue}break}}I[e|0]=0;sa=d+320|0}function Kd(a){a=a|0;var b=0,c=0,d=0,e=0,f=0,g=0;b=K[a>>2];c=b;K[a>>2]=b+1;a:{b:{c:{d:{e:{f:{g:{f=L[b|0];switch((f>>>4|0)-8|0){case 0:case 1:case 2:case 3:break b;case 7:break e;case 6:break f;case 4:case 5:break g;default:break a}}d=b+2|0;e=K[a+4>>2];if(d>>>0>=e>>>0){break d}K[a>>2]=d;c=L[c+1|0];if((c&192)!=128){break c}return c&63|f<<6&1984}d=b+3|0;e=K[a+4>>2];if(d>>>0>=e>>>0){break d}c=b+2|0;K[a>>2]=c;b=L[b+1|0];if((b&192)!=128){d=c;break c}K[a>>2]=d;c=L[c|0];if((c&192)!=128){break c}return c&63|(b&63|f<<6&960)<<6}e=K[a+4>>2];c=b+4|0;if(e>>>0<=c>>>0){break d}d=b+2|0;K[a>>2]=d;e=L[b+1|0];if((e&192)!=128){break c}d=b+3|0;K[a>>2]=d;g=L[b+2|0];if((g&192)!=128){break c}K[a>>2]=c;b=L[d|0];d=c;if((b&192)!=128){break c}a=b&63|(g<<6&4032|(e&63|f<<6&960)<<12);return(a>>>0>=1114112?65533:a)|0}K[a>>2]=e;break b}K[a>>2]=d-1}f=65533}return f|0}function jc(a,b,c,d){var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;e=sa-432|0;sa=e;k=Mb(a,b,c,d);a:{if(!d|!(k&536870912)){break a}J[e+48>>1]=8192;d=Ca(e+48|2,d);if(!L[d|0]){break a}h=e+224|0;f=1;i=200;while(1){Ga(e+44|0,d);b=wb(K[e+44>>2]);g=K[c>>2];b:{if(b){K[c>>2]=g|2;Pa(xb(K[e+44>>2]),d);break b}K[c>>2]=g&-3}l=K[33264];Mb(a,d,c,0);c:{if(f&1){K[e+16>>2]=189088;g=sb(h,i,84130,e+16|0);break c}K[e+32>>2]=15;K[e+36>>2]=189088;g=sb(h,i,84434,e+32|0)}b=K[33264];f=b+1|0;K[33264]=f;if(b>>>0<=2147483646){while(1){b=d;d=d+1|0;j=I[b|0];if(!((j|0)==32|j-9>>>0<5)){continue}while(1){d=b;b=d+1|0;j=I[d|0];if((j|0)==32|j-9>>>0<5){continue}break}f=f-1|0;K[33264]=f;if((f|0)>0){continue}break}}h=h+g|0;K[33264]=l;if(L[d|0]){f=0;i=i-g|0;if((i|0)>1){continue}}break}if((e+224|0)==(h|0)){break a}K[e>>2]=e+224;sb(189088,200,84130,e)}sa=e+432|0;return k}function td(a,b,c,d,e,f,g,h){var i=0,j=0;i=K[32972];j=K[i+116>>2];J[a+8>>1]=M[a+8>>1]+f;f=h&32?0-f|0:f;J[a+10>>1]=f+M[a+10>>1];J[a+12>>1]=f+M[a+12>>1];f=(Q(b,j)|0)/256|0;b=J[a+6>>1];f=(f-b|0)/2|0;d=(d|0)>(f|0)?f:d;J[a+6>>1]=((c|0)<(d|0)?d:c)+b;a:{b:{switch(e-1|0){case 0:c=J[a+4>>1];b=235-c|0;b=(b|0)<=-100?-100:b;J[a+4>>1]=((b|0)>=-60?-60:b)+c;break a;case 1:c=J[a+4>>1];b=235-c|0;b=(b|0)<=-300?-300:b;b=(b|0)>=-150?-150:b;J[a+4>>1]=b+c;J[a+2>>1]=b+M[a+2>>1];break a;case 2:break b;default:break a}}c=J[a+4>>1];b=100-c|0;b=(b|0)<=-400?-400:b;b=(b|0)>-300?-400:b;J[a+4>>1]=b+c;J[a+2>>1]=b+M[a+2>>1]}if(!K[i+132>>2]){I[a+20|0]=(Q(L[a+20|0],g)>>>0)/100;I[a+21|0]=(Q(L[a+21|0],g)>>>0)/100;I[a+22|0]=(Q(L[a+22|0],g)>>>0)/100;I[a+23|0]=(Q(L[a+23|0],g)>>>0)/100;I[a+24|0]=(Q(L[a+24|0],g)>>>0)/100;I[a+25|0]=(Q(L[a+25|0],g)>>>0)/100}}function qc(a){var b=0,c=0,d=0,e=0,f=0;e=sa-48|0;sa=e;a:{b:{if(a){c:{if(L[a|0]){break c}a=ec(84285);if(L[a|0]?a:0){break c}a=ec(121696);if(L[a|0]?a:0){break c}a=ec(84614);if(L[a|0]?a:0){break c}a=84891}d:{while(1){c=L[a+b|0];if(!(!c|(c|0)==47)){d=23;b=b+1|0;if((b|0)!=23){continue}break d}break}d=b}c=84891;e:{f:{g:{b=L[a|0];h:{i:{if(!(L[a+d|0]|(b|0)==46)){c=a;if((b|0)!=67){break i}}if(!L[c+1|0]){break h}}if(!Oa(c,84891)){break h}if(Oa(c,85136)){break g}}b=121652;if(L[c+1|0]==46){break f}a=0;break e}b=K[56851];if(b){while(1){if(!Oa(c,b+8|0)){break f}b=K[b+32>>2];if(b){continue}break}}a=Qa(36);if(a){b=K[30414];K[a>>2]=K[30413];K[a+4>>2]=b;b=a+8|0;Fa(b,c,d);I[b+d|0]=0;K[a+32>>2]=K[56851];K[56851]=a}b=a?a:121652}a=b}if((a|0)==-1){break a}K[56809]=a;break b}a=K[56809]}f=a?a+8|0:84309}sa=e+48|0;return f}function Ia(a){var b=0,c=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0;b=K[a+112>>2];d=K[a+116>>2];i=(b|d)!=0;e=b;f=K[a+4>>2];h=K[a+44>>2];b=f-h|0;g=b;c=b+K[a+120>>2]|0;b=K[a+124>>2]+(b>>31)|0;a:{b=c>>>0<g>>>0?b+1|0:b;if(!(((b|0)>=(d|0)&c>>>0>=e>>>0|(b|0)>(d|0))&i)){i=xc(a);if((i|0)>=0){break a}f=K[a+4>>2];h=K[a+44>>2]}K[a+112>>2]=-1;K[a+116>>2]=-1;K[a+104>>2]=f;g=c;c=h-f|0;d=g+c|0;b=(c>>31)+b|0;K[a+120>>2]=d;K[a+124>>2]=c>>>0>d>>>0?b+1|0:b;return-1}d=c+1|0;b=d?b:b+1|0;f=K[a+4>>2];h=K[a+8>>2];e=K[a+116>>2];g=e;c=K[a+112>>2];b:{if(!(e|c)){break b}e=c-d|0;c=g-(b+(c>>>0<d>>>0)|0)|0;j=h-f|0;g=j>>31;if((c|0)>=(g|0)&e>>>0>=j>>>0|(c|0)>(g|0)){break b}h=e+f|0}K[a+104>>2]=h;c=K[a+44>>2];e=c-f|0;d=e+d|0;b=(e>>31)+b|0;K[a+120>>2]=d;K[a+124>>2]=d>>>0<e>>>0?b+1|0:b;if(c>>>0>=f>>>0){I[f-1|0]=i}return i}function ag(a,b,c){a=a|0;b=b|0;c=c|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0;f=sa-32|0;sa=f;d=K[a+28>>2];K[f+16>>2]=d;g=K[a+20>>2];K[f+28>>2]=c;K[f+24>>2]=b;b=g-d|0;K[f+20>>2]=b;g=b+c|0;i=2;a:{b:{b=f+16|0;d=$(K[a+60>>2],b|0,2,f+12|0)|0;if(d){K[56798]=d;d=-1}else{d=0}c:{d:{if(d){d=b;break d}while(1){e=K[f+12>>2];if((e|0)==(g|0)){break c}if((e|0)<0){d=b;break b}h=K[b+4>>2];j=h>>>0<e>>>0;d=(j<<3)+b|0;h=e-(j?h:0)|0;K[d>>2]=h+K[d>>2];b=(j?12:4)+b|0;K[b>>2]=K[b>>2]-h;g=g-e|0;b=d;i=i-j|0;e=$(K[a+60>>2],b|0,i|0,f+12|0)|0;if(e){K[56798]=e;e=-1}else{e=0}if(!e){continue}break}}if((g|0)!=-1){break b}}b=K[a+44>>2];K[a+28>>2]=b;K[a+20>>2]=b;K[a+16>>2]=b+K[a+48>>2];a=c;break a}K[a+28>>2]=0;K[a+16>>2]=0;K[a+20>>2]=0;K[a>>2]=K[a>>2]|32;a=0;if((i|0)==2){break a}a=c-K[d+4>>2]|0}sa=f+32|0;return a|0}function zc(a,b,c){var d=0,e=0;a:{if((a|0)==(b|0)){break a}e=a+c|0;if(b-e>>>0<=0-(c<<1)>>>0){return Fa(a,b,c)}d=(a^b)&3;b:{c:{if(a>>>0<b>>>0){if(d){d=a;break b}if(!(a&3)){d=a;break c}d=a;while(1){if(!c){break a}I[d|0]=L[b|0];b=b+1|0;c=c-1|0;d=d+1|0;if(d&3){continue}break}break c}d:{if(d){break d}if(e&3){while(1){if(!c){break a}c=c-1|0;d=c+a|0;I[d|0]=L[b+c|0];if(d&3){continue}break}}if(c>>>0<=3){break d}while(1){c=c-4|0;K[c+a>>2]=K[b+c>>2];if(c>>>0>3){continue}break}}if(!c){break a}while(1){c=c-1|0;I[c+a|0]=L[b+c|0];if(c){continue}break}break a}if(c>>>0<=3){break b}while(1){K[d>>2]=K[b>>2];b=b+4|0;d=d+4|0;c=c-4|0;if(c>>>0>3){continue}break}}if(!c){break a}while(1){I[d|0]=L[b|0];d=d+1|0;b=b+1|0;c=c-1|0;if(c){continue}break}}return a}function fe(a,b,c,d){a:{switch(b-9|0){case 0:b=K[c>>2];K[c>>2]=b+4;K[a>>2]=K[b>>2];return;case 6:b=K[c>>2];K[c>>2]=b+4;b=J[b>>1];K[a>>2]=b;K[a+4>>2]=b>>31;return;case 7:b=K[c>>2];K[c>>2]=b+4;K[a>>2]=M[b>>1];K[a+4>>2]=0;return;case 8:b=K[c>>2];K[c>>2]=b+4;b=I[b|0];K[a>>2]=b;K[a+4>>2]=b>>31;return;case 9:b=K[c>>2];K[c>>2]=b+4;K[a>>2]=L[b|0];K[a+4>>2]=0;return;case 16:b=K[c>>2]+7&-8;K[c>>2]=b+8;P[a>>3]=P[b>>3];return;case 17:wa[d|0](a,c);default:return;case 1:case 4:case 14:b=K[c>>2];K[c>>2]=b+4;b=K[b>>2];K[a>>2]=b;K[a+4>>2]=b>>31;return;case 2:case 5:case 11:case 15:b=K[c>>2];K[c>>2]=b+4;K[a>>2]=K[b>>2];K[a+4>>2]=0;return;case 3:case 10:case 12:case 13:break a}}b=K[c>>2]+7&-8;K[c>>2]=b+8;c=K[b+4>>2];K[a>>2]=K[b>>2];K[a+4>>2]=c}function de(a,b,c,d,e,f){var g=0;g=sa-80|0;sa=g;a:{if((f|0)>=16384){Ja(g+32|0,b,c,d,e,0,0,0,2147352576);d=K[g+40>>2];e=K[g+44>>2];b=K[g+32>>2];c=K[g+36>>2];if(f>>>0<32767){f=f-16383|0;break a}Ja(g+16|0,b,c,d,e,0,0,0,2147352576);f=((f|0)>=49149?49149:f)-32766|0;d=K[g+24>>2];e=K[g+28>>2];b=K[g+16>>2];c=K[g+20>>2];break a}if((f|0)>-16383){break a}Ja(g- -64|0,b,c,d,e,0,0,0,7471104);d=K[g+72>>2];e=K[g+76>>2];b=K[g+64>>2];c=K[g+68>>2];if(f>>>0>4294934644){f=f+16269|0;break a}Ja(g+48|0,b,c,d,e,0,0,0,7471104);f=((f|0)<=-48920?-48920:f)+32538|0;d=K[g+56>>2];e=K[g+60>>2];b=K[g+48>>2];c=K[g+52>>2]}Ja(g,b,c,d,e,0,0,0,f+16383<<16);b=K[g+12>>2];K[a+8>>2]=K[g+8>>2];K[a+12>>2]=b;b=K[g+4>>2];K[a>>2]=K[g>>2];K[a+4>>2]=b;sa=g+80|0}function Td(a,b){var c=0,d=0,e=0;c=sa+-64|0;sa=c;d=K[a>>2];e=K[d-4>>2];d=K[d-8>>2];K[c+32>>2]=0;K[c+36>>2]=0;K[c+40>>2]=0;K[c+44>>2]=0;K[c+48>>2]=0;K[c+52>>2]=0;I[c+55|0]=0;I[c+56|0]=0;I[c+57|0]=0;I[c+58|0]=0;I[c+59|0]=0;I[c+60|0]=0;I[c+61|0]=0;I[c+62|0]=0;K[c+24>>2]=0;K[c+28>>2]=0;K[c+20>>2]=0;K[c+16>>2]=125084;K[c+12>>2]=a;K[c+8>>2]=b;a=a+d|0;d=0;a:{if(qb(e,b,0)){K[c+56>>2]=1;wa[K[K[e>>2]+20>>2]](e,c+8|0,a,a,1,0);d=K[c+32>>2]==1?a:0;break a}wa[K[K[e>>2]+24>>2]](e,c+8|0,a,1,0);b:{switch(K[c+44>>2]){case 0:d=K[c+48>>2]==1?K[c+36>>2]==1?K[c+40>>2]==1?K[c+28>>2]:0:0:0;break a;case 1:break b;default:break a}}if(K[c+32>>2]!=1){if(K[c+48>>2]|K[c+36>>2]!=1|K[c+40>>2]!=1){break a}}d=K[c+24>>2]}sa=c- -64|0;return d}function Db(a,b,c,d,e){var f=0,g=0,h=0;f=sa-80|0;sa=f;J[f+72>>1]=0;K[f+64>>2]=0;K[f+68>>2]=0;I[d|0]=0;g=f- -64|0;h=g|2;g=Pa(b,h)+g|0;I[g+2|0]=32;a:{if((c|0)==-1){if(Da(a,h,d)){break a}I[f+65|0]=95;if(Da(a,f- -64|1,f+16|0)|K[a+212>>2]==25966){break a}ic(85055);if(Da(K[47194],h,f+16|0)){I[d|0]=21;I[d+1|0]=0}ab(K[K[32972]+60>>2]);break a}b:{if(b>>>0>=33){if(!Sa(b)){break b}}K[f>>2]=b;b=f- -64|1;Aa(b,85485,f);Da(a,b,d);break a}I[g+3|0]=(c|0)==32?32:31;I[f+65|0]=95;c:{if(Da(a,f- -64|1,f+16|0)){break c}I[f+65|0]=32;if(Da(a,h,f+16|0)){break c}jb(a,h,f+16|0,40,0,268435456,0)}if(!L[f+16|0]){Id(a,b,f+16|0)}b=Ca(d,f+16|0);c=L[b|0];if(!c|(c|0)==21){break a}K[f+56>>2]=0;K[f+60>>2]=0;kb(a,b,f+56|0,-1,e&1)}sa=f+80|0}function Ea(a,b,c){var d=0,e=0,f=0,g=0;a:{if(!c){break a}I[a|0]=b;d=a+c|0;I[d-1|0]=b;if(c>>>0<3){break a}I[a+2|0]=b;I[a+1|0]=b;I[d-3|0]=b;I[d-2|0]=b;if(c>>>0<7){break a}I[a+3|0]=b;I[d-4|0]=b;if(c>>>0<9){break a}d=0-a&3;e=d+a|0;b=Q(b&255,16843009);K[e>>2]=b;d=c-d&-4;c=d+e|0;K[c-4>>2]=b;if(d>>>0<9){break a}K[e+8>>2]=b;K[e+4>>2]=b;K[c-8>>2]=b;K[c-12>>2]=b;if(d>>>0<25){break a}K[e+24>>2]=b;K[e+20>>2]=b;K[e+16>>2]=b;K[e+12>>2]=b;K[c-16>>2]=b;K[c-20>>2]=b;K[c-24>>2]=b;K[c-28>>2]=b;g=e&4|24;c=d-g|0;if(c>>>0<32){break a}d=vg(b,0,1,1);f=va;b=e+g|0;while(1){K[b+24>>2]=d;K[b+28>>2]=f;K[b+16>>2]=d;K[b+20>>2]=f;K[b+8>>2]=d;K[b+12>>2]=f;K[b>>2]=d;K[b+4>>2]=f;b=b+32|0;c=c-32|0;if(c>>>0>31){continue}break}}return a}function Ac(){var a=0,b=0,c=0,d=0,e=0,f=0;c=sa-208|0;sa=c;d=K[50303];if((d|0)>0){while(1){b=(a<<2)+201216|0;e=K[b>>2];if(e){Ha(e);K[b>>2]=0}a=a+1|0;if((d|0)!=(a|0)){continue}break}}K[50303]=0;K[c+16>>2]=137584;K[c+20>>2]=47;a=c+32|0;Aa(a,87827,c+16|0);kd(a,Ba(a)+1|0,0);K[c+4>>2]=47;K[c>>2]=137584;Aa(a,87933,c);kd(a,Ba(a)+1|0,1);a=K[50303];b=a<<2;K[b+201216>>2]=0;d=K[50741];b=yb(d,b+4|0);if(b){K[50741]=b;oe(201216,a,7);d=K[50741];b=0;a=K[50304];if(a){e=0;while(1){f=K[a+4>>2];a:{if(!L[f|0]){break a}if(!Oa(f+1|0,86589)){break a}if(!$a(K[a+8>>2],88032,3)){break a}K[(b<<2)+d>>2]=a;b=b+1|0}e=e+1|0;a=K[(e<<2)+201216>>2];if(a){continue}break}}K[(b<<2)+d>>2]=0}sa=c+208|0;return d}function vc(a,b,c){var d=0,e=0,f=0,g=0,h=0;f=b-1|0;a:{if((b|0)>=2){b=a;b:{while(1){c:{d:{e:{d=K[c+4>>2];e=K[c+8>>2];if((d|0)==(e|0)){break e}g=Wb(d,10,e-d|0);f:{if(g){d=K[c+4>>2];e=(g-d|0)+1|0;break f}d=K[c+4>>2];e=K[c+8>>2]-d|0}h=d;d=e>>>0<f>>>0?e:f;Fa(b,h,d);e=d+K[c+4>>2]|0;K[c+4>>2]=e;b=b+d|0;if(g){break c}f=f-d|0;if(!f){break c}if((e|0)==K[c+8>>2]){break e}K[c+4>>2]=e+1;d=L[e|0];break d}d=xc(c);if((d|0)>=0){break d}d=0;if((a|0)==(b|0)){break b}if(L[c|0]&16){break c}break b}I[b|0]=d;b=b+1|0;if((d&255)==10){break c}f=f-1|0;if(f){continue}}break}if(!a){d=0;break b}I[b|0]=0;d=a}break a}b=K[c+72>>2];K[c+72>>2]=b-1|b;if(f){break a}I[a|0]=0;return a}return d}function vd(a){var b=0,c=0,d=0,e=0,f=0,g=0,h=0,i=0;b=Q(a,44);a=K[b+137896>>2];if((a|0)>0){vd(a-1|0)}a=K[36115];c=b+137856|0;b=K[c+36>>2];a:{if((b|0)<=0){break a}e=K[c+32>>2];h=b&1;b:{if((b|0)==1){c=0;break b}i=b&-2;c=0;while(1){d=c<<4;f=d+e|0;b=L[f+10|0];K[(b<<2)+144464>>2]=f;c:{if((a|0)>=(b|0)){b=a;break c}a=a+1|0;Ea((a<<2)+144464|0,0,b-a<<2)}d=(d|16)+e|0;a=L[d+10|0];K[(a<<2)+144464>>2]=d;d:{if((a|0)<=(b|0)){a=b;break d}b=b+1|0;Ea((b<<2)+144464|0,0,a-b<<2)}c=c+2|0;g=g+2|0;if((i|0)!=(g|0)){continue}break}}if(!h){break a}c=(c<<4)+e|0;b=L[c+10|0];K[(b<<2)+144464>>2]=c;if((a|0)>=(b|0)){break a}a=a+1|0;Ea((a<<2)+144464|0,0,b-a<<2);a=b}K[36115]=a}function Ed(a,b,c,d,e){var f=0,g=0,h=0,i=0;f=sa-16|0;sa=f;a:{if(!(I[a+106|0]&1)){break a}g=L[c|0];if(!(I[d+2|0]&1)&(g|0)!=46){break a}i=K[d+12>>2];if(i&256|!(i&2?e:1)){break a}b:{if((g|0)==46){Ga(f+12|0,c+2|0);break b}Ga(f+12|0,c)}g=L[c|0];if(!g|!L[c+1|0]){break a}i=K[f+12>>2];if(!(!i|L[d+2|0]&2)){if(!Ma(i)){break a}g=L[c|0]}if((g|0)==46){I[c|0]=32}h=2;if(K[a+212>>2]!=26741|e){break a}if(Ma(K[f+12>>2])){c=jc(a,c+2|0,0,0)}else{c=0}c:{if(!(L[a+8233|0]&128)){break c}e=K[f+12>>2];if(!(!e|L[d+2|0]&2)&e-48>>>0>=10){break c}h=0}h=c&32768?0:h;if(!(c&131072)){break a}h=K[a+8232>>2]&163840?34:L[b-2|0]!=45?h:0}sa=f+16|0;return h}function ie(a,b,c,d,e){var f=0,g=0,h=0,i=0;f=sa-208|0;sa=f;K[f+204>>2]=c;c=f+160|0;Ea(c,0,40);K[f+200>>2]=K[f+204>>2];a:{if((he(0,b,f+200|0,f+80|0,c,d,e)|0)<0){e=-1;break a}i=K[a+76>>2]>=0;g=K[a>>2];if(K[a+72>>2]<=0){K[a>>2]=g&-33}b:{c:{d:{if(!K[a+48>>2]){K[a+48>>2]=80;K[a+28>>2]=0;K[a+16>>2]=0;K[a+20>>2]=0;h=K[a+44>>2];K[a+44>>2]=f;break d}if(K[a+16>>2]){break c}}c=-1;if(ed(a)){break b}}c=he(a,b,f+200|0,f+80|0,f+160|0,d,e)}if(h){wa[K[a+36>>2]](a,0,0)|0;K[a+48>>2]=0;K[a+44>>2]=h;K[a+28>>2]=0;b=K[a+20>>2];K[a+16>>2]=0;K[a+20>>2]=0;c=b?c:-1}b=a;a=K[a>>2];K[b>>2]=a|g&32;e=a&32?-1:c;if(!i){break a}}sa=f+208|0;return e}function Fd(a,b,c,d){var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;h=sa-208|0;sa=h;f=L[b|0];if(f){while(1){I[e+h|0]=f;i=((f&255)==6&(g|0)!=21)+i|0;g=f<<24>>24;e=e+1|0;f=L[e+b|0];if(f){continue}break}}I[e+h|0]=0;e=L[h|0];if(e){k=i-2|0;g=0;l=(d|0)<2;f=0;while(1){a:{b:{if(!((e&255)!=6|l|(f|0)==21)){e=g+1|0;if(L[a+169|0]){f=(e|0)>1?5:6;d=e;break b}f=6;d=i;if((e|0)==(i|0)){break b}f=(e|0)%3|0?5:(g|0)==(k|0)?5:6;d=e;break b}d=e&255;if((d|0)==255){if(!j|(c|0)<2){break a}d=c>>>0>2?11:(g|0)%3|0?23:11}f=d;d=g}g=d;I[b|0]=f;b=b+1|0}j=j+1|0;e=L[j+h|0];if(e){continue}break}}if((c|0)>=2){I[b|0]=11;b=b+1|0}I[b|0]=0;sa=h+208|0}function tb(a,b){var c=0;c=0;a:{if(!a){break a}c=K[50754];a=(Q(K[(b?12:((a|0)>199)<<2)+145712>>2],a)|0)/256|0;b=K[36430];a=a>>>0>b>>>0?a:b;if(a>>>0<=89999){c=(Q(a,c)>>>0)/1e3|0;break a}c=(Q(a,(c|0)/25|0)>>>0)/40|0}a=K[36440];b:{if((a|0)<=0){break b}b=K[36424];if((b|0)<0){break b}b=(b<<4)+216192|0;if(!K[b+4>>2]){K[b+4>>2]=a}K[36440]=0}K[36426]=0;K[36439]=-1;K[36455]=K[50758];Nb();K[36427]=-1;a=(K[50758]<<4)+216192|0;K[a>>2]=5;K[a+4>>2]=c;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0;K[36426]=0;if(K[36438]){K[36438]=0;a=(K[50758]<<4)+216192|0;K[a>>2]=14;K[a+4>>2]=0;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0}}function Gb(a,b,c,d,e,f,g,h){var i=0,j=0,k=0,l=0;i=1;j=d&2147483647;l=j;k=(j|0)==2147418112;a:{if(k&!c?a|b:k&(c|0)!=0|j>>>0>2147418112){break a}j=h&2147483647;k=(j|0)==2147418112;if(k&!g?e|f:k&(g|0)!=0|j>>>0>2147418112){break a}if(!(a|e|(c|g)|(b|f|(j|l)))){return 0}i=d&h;if((i|0)>0|(i|0)>=0){i=-1;if((c|0)==(g|0)&(d|0)==(h|0)?(b|0)==(f|0)&a>>>0<e>>>0|b>>>0<f>>>0:c>>>0<g>>>0&(d|0)<=(h|0)|(d|0)<(h|0)){break a}return(a^e|c^g|(b^f|d^h))!=0}i=-1;if((c|0)==(g|0)&(d|0)==(h|0)?(b|0)==(f|0)&a>>>0>e>>>0|b>>>0>f>>>0:c>>>0>g>>>0&(d|0)>=(h|0)|(d|0)>(h|0)){break a}i=(a^e|c^g|(b^f|d^h))!=0}return i}function Ab(a,b){var c=0,d=0,e=0,f=0;c=L[85836]|L[85837]<<8;I[b|0]=c;I[b+1|0]=c>>>8;I[b+2|0]=L[85838];while(1){e=L[a|0];c=a+1|0;a=c;if((e|0)==255){continue}if(e){d=K[(e<<2)+144464>>2];if(!d){continue}a:{if(L[d+11|0]!=1){break a}f=L[d+14|0];if(M[d+8>>1]|f>>>0>4){break a}if(f>>>0<2){continue}I[b|0]=L[f+93943|0];b=b+1|0;continue}a=K[d>>2];if(a&255){while(1){I[b|0]=a;b=b+1|0;d=a&65280;a=a>>>8|0;if(d){continue}break}}a=c;if((e|0)!=21){continue}c=I[a|0];if((c|32)-97>>>0>=26){continue}while(1){I[b|0]=c;b=b+1|0;a=a+1|0;c=I[a|0];if((c|32)-97>>>0<26){continue}break}continue}break}I[b|0]=0}function Ff(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;if(qb(a,K[b+8>>2],e)){if(!(K[b+28>>2]==1|K[b+4>>2]!=(c|0))){K[b+28>>2]=d}return}a:{if(qb(a,K[b>>2],e)){if(!(K[b+16>>2]!=(c|0)&K[b+20>>2]!=(c|0))){if((d|0)!=1){break a}K[b+32>>2]=1;return}K[b+32>>2]=d;b:{if(K[b+44>>2]==4){break b}J[b+52>>1]=0;a=K[a+8>>2];wa[K[K[a>>2]+20>>2]](a,b,c,c,1,e);if(L[b+53|0]){K[b+44>>2]=3;if(!L[b+52|0]){break b}break a}K[b+44>>2]=4}K[b+20>>2]=c;K[b+40>>2]=K[b+40>>2]+1;if(K[b+36>>2]!=1|K[b+24>>2]!=2){break a}I[b+54|0]=1;return}a=K[a+8>>2];wa[K[K[a>>2]+24>>2]](a,b,c,d,e)}}function Bc(a,b){var c=0,d=0,e=0,f=0,g=0;d=sa-112|0;sa=d;a:{if(a){break a}if(K[50303]){a=201216;break a}Ac();a=201216}c=d+16|0;La(c,b,40);K[d>>2]=47;K[d+4>>2]=c;b=d- -64|0;Aa(b,87599,d);g=Ba(b);f=-1;e=K[a>>2];b:{c:{d:{if(e){b=0;c=-1;e:{while(1){if($c(d+16|0,K[e>>2])){e=K[e+8>>2];f:{if(!$c(d+16|0,e)){c=b;break f}f=$c(d- -64|0,e+(Ba(e)-g|0)|0)?f:b}b=b+1|0;e=K[(b<<2)+a>>2];if(e){continue}break e}break}if((b|0)>=0){break c}b=(c|0)<0?f:c;break d}b=c;if((b|0)>=0){break d}}b=f}c=0;if((b|0)<0){break b}}c=K[(b<<2)+a>>2]}sa=d+112|0;return c}function rb(a,b){var c=0,d=0,e=0,f=0,g=0,h=0,i=0;f=sa-16|0;sa=f;C(+b);g=x(1)|0;d=x(0)|0;c=g&2147483647;e=c+-1048576|0;a:{if((e|0)==2145386495|e>>>0<2145386495){h=d<<28;e=c>>>4|0;c=(c&15)<<28|d>>>4;d=e+1006632960|0;break a}if((c|0)==2146435072|c>>>0>2146435072){h=d<<28;c=(g&15)<<28|d>>>4;d=g>>>4|2147418112;break a}if(!(c|d)){c=0;d=0;break a}e=c;c=c?T(c):T(d)+32|0;Xa(f,d,e,0,0,c+49|0);i=K[f>>2];h=K[f+4>>2];e=15372-c<<16;c=K[f+8>>2];d=e|K[f+12>>2]^65536}K[a>>2]=i;K[a+4>>2]=h;K[a+8>>2]=c;K[a+12>>2]=g&-2147483648|d;sa=f+16|0}function Zc(a,b,c){var d=0,e=0;e=a;a:{b:{c:{d:{if((e^b)&3){break d}d=(c|0)!=0;e:{if(!(b&3)|!c){break e}while(1){d=L[b|0];I[e|0]=d;if(!d){break a}e=e+1|0;c=c-1|0;d=(c|0)!=0;b=b+1|0;if(!(b&3)){break e}if(c){continue}break}}if(!d){break b}if(!L[b|0]){break a}if(c>>>0<4){break d}while(1){d=K[b>>2];if((d^-1)&d-16843009&-2139062144){break c}K[e>>2]=d;e=e+4|0;b=b+4|0;c=c-4|0;if(c>>>0>3){continue}break}}if(!c){break b}}while(1){d=L[b|0];I[e|0]=d;if(!d){break a}e=e+1|0;b=b+1|0;c=c-1|0;if(c){continue}break}}c=0}Ea(e,0,c);return a}function sc(a,b,c,d,e,f){var g=0,h=0,i=0,j=0;h=sa-240|0;sa=h;g=K[c>>2];K[h+232>>2]=g;c=K[c+4>>2];K[h>>2]=a;K[h+236>>2]=c;j=1;a:{b:{c:{if(!(c|(g|0)!=1)){c=a;break c}g=a;while(1){i=(d<<2)+f|0;c=g-K[i>>2]|0;if((Jb(c,a,b)|0)<=0){c=g;break c}d:{if(!((d|0)<2|e)){e=K[i-8>>2];i=g-4|0;if((Jb(i,c,b)|0)>=0){break d}if((Jb(i-e|0,c,b)|0)>=0){break d}}K[(j<<2)+h>>2]=c;g=h+232|0;e=qe(g);tc(g,e);j=j+1|0;d=d+e|0;e=0;g=c;if(K[h+236>>2]|K[h+232>>2]!=1){continue}break b}break}c=g;break b}if(e){break a}}pe(h,j);ad(c,b,d,f)}sa=h+240|0}function _b(a,b){var c=0;a:{if((a|0)>4){break a}}c=a<<2;K[(c+134912|0)+4>>2]=b;K[c+136192>>2]=b;c=28;b:{c:{d:{switch(a-1|0){case 0:K[50792]=b;K[50786]=b;Hc(3);break c;case 1:K[50787]=b;K[33037]=(Q(L[K[50797]+105596|0],(Q(K[50787],55)|0)/100|0)|0)/16;break c;case 2:a=(b|0)>=99?99:b;K[50785]=(a|0)>0?a:0;break c;case 3:K[50788]=(b|0)>=99?99:b;break c;case 12:K[47268]=b;break c;case 6:K[47205]=b;break c;case 9:break c;case 8:break d;default:break b}}a=b&255;if(a){K[K[47192]+152>>2]=a}K[47196]=b}c=0}return c}function Ra(a,b){var c=0,d=0,e=0;a:{if(!K[a>>2]){break a}while(1){b:{if(!Sa(K[a-4>>2])){break b}d=0;c=I[b|0];if((c|0)==K[a>>2]){while(1){d=d+1|0;c=I[d+b|0];a=a+4|0;if((c|0)==K[a>>2]){continue}break}}if(c){break b}while(1){b=a;a=a+4|0;if(Sa(K[b>>2])){continue}break}e=b+((K[b>>2]==61)<<2)|0;while(1){a=e;e=a+4|0;if(Sa(K[a>>2])){continue}break}c:{b=K[a>>2];switch(b-34|0){case 0:case 5:break a;default:break c}}if(Sa(b)){return 102808}return K[a>>2]==47?102808:a}a=a+4|0;if(K[a>>2]){continue}break}}return e}function ib(a,b,c,d){var e=0,f=0,g=0,h=0,i=0;a:{if(!(!L[a+25|0]|P[a+8>>3]!=c|P[a+16>>3]!=d)){g=L[a+24|0];d=P[a+48>>3];e=P[a+40>>3];f=P[a+32>>3];break a}P[a+16>>3]=d;P[a+8>>3]=c;f=+K[a>>2];e=nb(-3.141592653589793/f*d);d=e*-e;P[a+48>>3]=d;e=e*hb(-6.283185307179586/f*c);e=e+e;P[a+40>>3]=e;f=1-e-d;P[a+32>>3]=f;g=L[a+24|0];if(!g|c==0){break a}f=1/f;P[a+32>>3]=f;c=-f;d=d*c;P[a+48>>3]=d;e=e*c;P[a+40>>3]=e;g=1}I[a+25|0]=1;c=P[a+64>>3];h=P[a+56>>3];P[a+64>>3]=h;i=b;b=d*c+(f*b+e*h);P[a+56>>3]=g?i:b;return b}function _e(a,b,c,d,e){var f=0,g=0,h=0,i=0,j=0;a:{h=K[34388];if(!h){break a}g=K[34436];if((g|0)>=(K[34393]-2|0)){break a}K[34436]=g+1;f=Q(g,36)+h|0;K[f>>2]=a;K[f+4>>2]=K[34437];j=K[34438];K[f+12>>2]=b>>>24;K[f+8>>2]=b&16777215;K[f+24>>2]=j;b=K[50754];e=K[34439]+((e-K[34392]|0)/2|0)|0;K[f+20>>2]=e;i=+(e|0)*1e3/+(b|0);b:{if(S(i)<2147483648){b=~~i;break b}b=-2147483648}K[f+16>>2]=b;if(a-3>>>0<=1){K[(Q(g,36)+h|0)+28>>2]=K[33282]+c;return}b=(Q(g,36)+h|0)+28|0;K[b>>2]=c;if((a|0)!=7){break a}K[b+4>>2]=d}}function Fb(a,b,c,d,e,f){var g=0,h=0,i=0,j=0;a:{if(f&64){c=f+-64|0;b=c&31;if((c&63)>>>0>=32){c=0;b=e>>>b|0}else{c=e>>>b|0;b=((1<<b)-1&e)<<32-b|d>>>b}d=0;e=0;break a}if(!f){break a}i=d;h=64-f|0;g=h&31;if((h&63)>>>0>=32){h=i<<g;j=0}else{h=(1<<g)-1&i>>>32-g|e<<g;j=i<<g}i=b;b=f&31;if((f&63)>>>0>=32){g=0;b=c>>>b|0}else{g=c>>>b|0;b=((1<<b)-1&c)<<32-b|i>>>b}b=j|b;c=g|h;g=d;d=f&31;if((f&63)>>>0>=32){h=0;d=e>>>d|0}else{h=e>>>d|0;d=((1<<d)-1&e)<<32-d|g>>>d}e=h}K[a>>2]=b;K[a+4>>2]=c;K[a+8>>2]=d;K[a+12>>2]=e}function yc(a){var b=0,c=0,d=0;if(!a){if(K[33174]){b=yc(K[33174])}if(K[33136]){b=yc(K[33136])|b}a=K[56816];if(a){while(1){if(K[a+20>>2]!=K[a+28>>2]){b=yc(a)|b}a=K[a+56>>2];if(a){continue}break}}return b}d=K[a+76>>2]>=0;a:{b:{if(K[a+20>>2]==K[a+28>>2]){break b}wa[K[a+36>>2]](a,0,0)|0;if(K[a+20>>2]){break b}b=-1;break a}b=K[a+8>>2];c=K[a+4>>2];if((b|0)!=(c|0)){b=c-b|0;wa[K[a+40>>2]](a,b,b>>31,1)|0}b=0;K[a+28>>2]=0;K[a+16>>2]=0;K[a+20>>2]=0;K[a+4>>2]=0;K[a+8>>2]=0;if(!d){break a}}return b}function mc(a,b){var c=0,d=0,e=0,f=0,g=0;c=L[b|0];if((c&192)==128){while(1){b=b-1|0;c=L[b|0];if((c&192)==128){continue}break}}c=c<<24>>24;a:{if(!(c&128)){break a}d=1;b:{e=c&224;if((e|0)==192){break b}if((c&240)==224){d=2;g=1;break b}d=3;if((c&248)==240){break b}c=c&255;d=0;break a}c=L[d+93846|0]&c;f=L[b+1|0];if(!f){d=0;break a}c=f&63|c<<6;if((e|0)==192){break a}e=L[b+2|0];if(!e){d=1;break a}c=e&63|c<<6;if(g){break a}b=L[b+3|0];if(!b){d=2;break a}c=b&63|c<<6}K[a>>2]=c;return d+1|0}function Gc(a,b,c,d){var e=0,f=0,g=0;e=sa-224|0;sa=e;a:{if(!a){b=28;break a}K[e>>2]=137584;K[e+4>>2]=47;K[e+8>>2]=b;b=e+16|0;Aa(b,85430,e);f=vb(b);if((f|0)<0){b=zb(d,0-f|0,e+16|0);break a}b=Cb(e+16|0,85659);if(!b){b=zb(d,K[56798],e+16|0);break a}g=K[a>>2];if(g){Ha(g)}if(!f){b=0;K[a>>2]=0;break a}g=Qa(f);K[a>>2]=g;if(!g){_a(b);b=48;break a}if((dd(g,f,b)|0)!=(f|0)){c=K[56798];_a(b);Ha(K[a>>2]);K[a>>2]=0;b=zb(d,c,e+16|0);break a}_a(b);b=0;if(!c){break a}K[c>>2]=f}sa=e+224|0;return b}function Ga(a,b){var c=0,d=0,e=0,f=0,g=0;c=L[b|0];if((c&192)==128){while(1){b=b+1|0;c=L[b|0];if((c&192)==128){continue}break}}c=c<<24>>24;a:{if(!(c&128)){break a}d=1;b:{e=c&224;if((e|0)==192){break b}if((c&240)==224){d=2;g=1;break b}d=3;if((c&248)==240){break b}c=c&255;d=0;break a}c=L[d+93846|0]&c;f=L[b+1|0];if(!f){d=0;break a}c=f&63|c<<6;if((e|0)==192){break a}e=L[b+2|0];if(!e){d=1;break a}c=e&63|c<<6;if(g){break a}b=L[b+3|0];if(!b){d=2;break a}c=b&63|c<<6}K[a>>2]=c;return d+1|0}function Xa(a,b,c,d,e,f){var g=0,h=0,i=0;a:{if(f&64){d=b;e=f+-64|0;b=e&31;if((e&63)>>>0>=32){e=d<<b;d=0}else{e=(1<<b)-1&d>>>32-b|c<<b;d=d<<b}b=0;c=0;break a}if(!f){break a}g=d;d=f&31;if((f&63)>>>0>=32){h=g<<d;i=0}else{h=(1<<d)-1&g>>>32-d|e<<d;i=g<<d}g=b;e=64-f|0;d=e&31;if((e&63)>>>0>=32){e=0;b=c>>>d|0}else{e=c>>>d|0;b=((1<<d)-1&c)<<32-d|g>>>d}d=i|b;e=e|h;b=f&31;if((f&63)>>>0>=32){h=g<<b;b=0}else{h=(1<<b)-1&g>>>32-b|c<<b;b=g<<b}c=h}K[a>>2]=b;K[a+4>>2]=c;K[a+8>>2]=d;K[a+12>>2]=e}function _f(a,b,c){a=a|0;b=b|0;c=c|0;var d=0,e=0,f=0,g=0;e=sa-32|0;sa=e;K[e+16>>2]=b;d=K[a+48>>2];K[e+20>>2]=c-((d|0)!=0);f=K[a+44>>2];K[e+28>>2]=d;K[e+24>>2]=f;a:{b:{d=qa(K[a+60>>2],e+16|0,2,e+12|0)|0;if(d){K[56798]=d;d=-1}else{d=0}if(d){b=32}else{d=K[e+12>>2];if((d|0)>0){break b}b=d?32:16}K[a>>2]=b|K[a>>2];break a}g=d;f=K[e+20>>2];if(f>>>0>=d>>>0){break a}d=K[a+44>>2];K[a+4>>2]=d;K[a+8>>2]=d+(g-f|0);if(K[a+48>>2]){K[a+4>>2]=d+1;I[(b+c|0)-1|0]=L[d|0]}g=c}sa=e+32|0;return g|0}function Bb(a){var b=0;a:{if(a>>>0<=55295){b=L[K[(a>>>6&67108860)+125552>>2]+(a&255)|0];break a}b=4;if(a>>>0<57344){break a}if(a>>>0<63488){b=3;break a}if(a>>>0<=195327){b=L[K[(a-63488>>>6&67108860)+126416>>2]+(a&255)|0];break a}b=2;if(a>>>0<917504){break a}if(a>>>0<=918015){b=L[K[(a-917504>>>6&67108860)+128476>>2]+(a&255)|0];break a}if(a>>>0<983040){break a}if(a>>>0<1048574){b=3;break a}if(a>>>0<1048576){break a}b=3;if(a>>>0<1114110){break a}b=a>>>0<1114112?2:5}return b&255}function Ye(a,b){var c=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0;c=K[33709];a:{if((c|0)<=0){break a}e=(a|0)>31?a-32|0:a;a=0;if(c>>>0>=4){k=c&-4;while(1){g=a|3;h=a|2;i=a|1;d=K[(g<<6)+134912>>2]==(e|0)?g:K[(h<<6)+134912>>2]==(e|0)?h:K[(i<<6)+134912>>2]==(e|0)?i:K[(a<<6)+134912>>2]==(e|0)?a:d;a=a+4|0;f=f+4|0;if((k|0)!=(f|0)){continue}break}}f=c&3;if(f){while(1){d=K[(a<<6)+134912>>2]==(e|0)?a:d;a=a+1|0;j=j+1|0;if((f|0)!=(j|0)){continue}break}}if((d|0)<=0){break a}K[33709]=d;c=d}Zb(b,c)}function Le(a){var b=0,c=0,d=0,e=0;b=sa-96|0;sa=b;La(b,a,60);Cc(b,1);while(1){d=b+c|0;e=xb(I[d|0]);I[d|0]=e;c=c+1|0;if(e&255){continue}break}K[b+92>>2]=0;K[b+84>>2]=0;K[b+88>>2]=0;K[b+76>>2]=0;K[b+80>>2]=0;K[b+72>>2]=a;a:{b:{c:{if(Lb(b,1)){if(L[202976]){break c}break b}if(!K[50303]){Ac()}c=268437247;a=Bc(201216,b);if(!a){break a}if(!Lb(K[a+8>>2],0)){break a}if(!L[202976]){break b}}Lb(202976,2)}Ue(K[32972]);K[b+76>>2]=K[32972]+40;zd(b+72|0,202976);c=0}sa=b+96|0;return c}
      function Yd(a,b){if(!a){return 0}a:{b:{if(a){if(b>>>0<=127){break b}c:{if(!K[K[56841]>>2]){if((b&-128)==57216){break b}break c}if(b>>>0<=2047){I[a+1|0]=b&63|128;I[a|0]=b>>>6|192;a=2;break a}if(!((b&-8192)!=57344&b>>>0>=55296)){I[a+2|0]=b&63|128;I[a|0]=b>>>12|224;I[a+1|0]=b>>>6&63|128;a=3;break a}if(b-65536>>>0<=1048575){I[a+3|0]=b&63|128;I[a|0]=b>>>18|240;I[a+2|0]=b>>>6&63|128;I[a+1|0]=b>>>12&63|128;a=4;break a}}K[56798]=25;a=-1}else{a=1}break a}I[a|0]=b;a=1}return a}function Fe(a){var b=0,c=0,d=0,e=0;K[a+20>>2]=0;c=K[a+8>>2];b=K[a+4>>2];d=c-b|0;if(d>>>0>=9){while(1){Ha(K[b>>2]);b=K[a+4>>2]+4|0;K[a+4>>2]=b;c=K[a+8>>2];d=c-b|0;if(d>>>0>8){continue}break}}e=512;a:{switch((d>>>2|0)-1|0){case 1:e=1024;case 0:K[a+16>>2]=e;break;default:break a}}b:{if((b|0)==(c|0)){break b}while(1){Ha(K[b>>2]);b=b+4|0;if((c|0)!=(b|0)){continue}break}b=K[a+8>>2];c=K[a+4>>2];if((b|0)==(c|0)){break b}K[a+8>>2]=b+((c-b|0)+3&-4)}a=K[a>>2];if(a){Ha(a)}}function Wb(a,b,c){var d=0,e=0;d=(c|0)!=0;a:{b:{c:{if(!(a&3)|!c){break c}e=b&255;while(1){if((e|0)==L[a|0]){break b}c=c-1|0;d=(c|0)!=0;a=a+1|0;if(!(a&3)){break c}if(c){continue}break}}if(!d){break a}if(!(L[a|0]==(b&255)|c>>>0<4)){d=Q(b&255,16843009);while(1){e=d^K[a>>2];if((e^-1)&e-16843009&-2139062144){break b}a=a+4|0;c=c-4|0;if(c>>>0>3){continue}break}}if(!c){break a}}b=b&255;while(1){if((b|0)==L[a|0]){return a}a=a+1|0;c=c-1|0;if(c){continue}break}}return 0}function _c(a,b){var c=0,d=0;a:{d=b&255;if(d){if(a&3){while(1){c=L[a|0];if(!c|(c|0)==(b&255)){break a}a=a+1|0;if(a&3){continue}break}}c=K[a>>2];b:{if((c^-1)&c-16843009&-2139062144){break b}d=Q(d,16843009);while(1){c=c^d;if((c^-1)&c-16843009&-2139062144){break b}c=K[a+4>>2];a=a+4|0;if(!(c-16843009&(c^-1)&-2139062144)){continue}break}}while(1){c=a;d=L[c|0];if(d){a=c+1|0;if((d|0)!=(b&255)){continue}}break}return c}return Ba(a)+a|0}return a}function Vd(a,b,c,d,e){var f=0,g=0,h=0;h=-1;g=d&2147483647;f=(g|0)==2147418112;a:{if(f&!c?a|b:f&(c|0)!=0|g>>>0>2147418112){break a}f=e&2147483647;if(((f|0)==2147418112&0|f>>>0>2147418112)&(f|0)!=2147418112){break a}if(!(a|c|(f|g|b))){return 0}f=d&e;if((f|0)>0|(f|0)>=0){if(((c|0)!=0|(d|0)!=(e|0))&(d|0)<(e|0)){break a}return(a|c|(d^e|b))!=0}if(!c&(d|0)==(e|0)?a|b:(c|0)!=0&(d|0)>=(e|0)|(d|0)>(e|0)){break a}h=(a|c|(d^e|b))!=0}return h}function Cc(a,b){var c=0,d=0;c=sa+-64|0;sa=c;I[202976]=0;K[c+48>>2]=47;Aa(c+59|0,91351,c+48|0);if(!b){I[c+59|0]=0}a:{b:{c:{if(!a){break c}a=mb(a,43);if(!a){break c}I[a|0]=0;a=a+1|0;if(I[a|0]-48>>>0>=10){break b}d=Kb(a)}if((d|0)<=0){break a}if(d>>>0<=9){K[c+4>>2]=d;K[c>>2]=c+59;Aa(202976,91378,c);break a}K[c+20>>2]=d-10;K[c+16>>2]=c+59;Aa(202976,91503,c+16|0);break a}K[c+36>>2]=a;K[c+32>>2]=c+59;Aa(202976,85425,c+32|0)}sa=c- -64|0}function ac(a){var b=0,c=0,d=0,e=0;c=sa-80|0;sa=c;b=Me(a,c+12|0);a:{if(!K[c+12>>2]){b=268437247;break a}d=c+16|0;La(d,b,60);b=0;Cc(d,1);if(!(!Lb(d,0)|!L[202976])){Lb(202976,2)}Ue(K[32972]);zd(a,86012)}sa=c+80|0;b:{c:{d:{e:{if((b|0)<=268437502){if(!b){break b}if((b|0)==268436479){break c}if((b|0)!=268437247){break e}return 2}if((b|0)==268437503|(b|0)==268437759){break d}if((b|0)==268439295){break b}}return-1}return 2}e=1}return e}function Ua(a,b,c,d,e,f,g,h,i){var j=0,k=0,l=0,m=0;i=vg(b,c,h,i);h=va;e=vg(d,e,f,g);i=e+i|0;d=va+h|0;h=e>>>0>i>>>0?d+1|0:d;j=g;e=0;k=c;d=0;c=vg(g,e,c,d);g=c+i|0;i=va+h|0;l=g;c=c>>>0>g>>>0?i+1|0:i;g=vg(f,0,b,0);h=va;i=0;d=vg(f,i,k,d);h=h+d|0;f=va+i|0;f=d>>>0>h>>>0?f+1|0:f;i=f+l|0;d=c;f=f>>>0>i>>>0?d+1|0:d;c=vg(b,m,j,e)+h|0;e=va;e=c>>>0<h>>>0?e+1|0:e;h=e+i|0;i=f;K[a+8>>2]=h;K[a+12>>2]=e>>>0>h>>>0?i+1|0:i;K[a>>2]=g;K[a+4>>2]=c}function Ca(a,b){var c=0,d=0;d=a;a:{b:{if((d^b)&3){c=L[b|0];break b}if(b&3){while(1){c=L[b|0];I[d|0]=c;if(!c){break a}d=d+1|0;b=b+1|0;if(b&3){continue}break}}c=K[b>>2];if((c^-1)&c-16843009&-2139062144){break b}while(1){K[d>>2]=c;c=K[b+4>>2];d=d+4|0;b=b+4|0;if(!(c-16843009&(c^-1)&-2139062144)){continue}break}}I[d|0]=c;if(!(c&255)){break a}while(1){c=L[b+1|0];I[d+1|0]=c;d=d+1|0;b=b+1|0;if(c){continue}break}}return a}function hb(a){var b=0,c=0,d=0;b=sa-16|0;sa=b;C(+a);d=x(1)|0;x(0)|0;d=d&2147483647;a:{if(d>>>0<=1072243195){c=1;if(d>>>0<1044816030){break a}c=gc(a,0);break a}c=a-a;if(d>>>0>=2146435072){break a}b:{switch(ze(a,b)&3){case 0:c=gc(P[b>>3],P[b+8>>3]);break a;case 1:c=-fc(P[b>>3],P[b+8>>3],1);break a;case 2:c=-gc(P[b>>3],P[b+8>>3]);break a;default:break b}}c=fc(P[b>>3],P[b+8>>3],1)}a=c;sa=b+16|0;return a}function Qc(a,b,c,d){var e=0,f=0,g=0;a:{if((Ba(d)+Ba(b)|0)>=(c|0)){break a}g=K[36115];c=d;while(1){e=L[c|0];if(e){c=c+1|0;if((e|0)>=(g|0)){continue}b:{c:{e=K[(e<<2)+144464>>2];switch(L[e+11|0]-1|0){case 1:break b;case 0:break c;default:continue}}f=L[e+14|0]<4|f;continue}if(!((L[e+4|0]>>>1|f)&1)){K[a+8212>>2]=K[a+8212>>2]+1}K[a+8208>>2]=K[a+8208>>2]+1;f=0;continue}break}if(!b){break a}Za(b,d)}}function pc(a){var b=0,c=0;b=sa-16|0;sa=b;C(+a);c=x(1)|0;x(0)|0;c=c&2147483647;a:{if(c>>>0<=1072243195){if(c>>>0<1045430272){break a}a=fc(a,0,0);break a}if(c>>>0>=2146435072){a=a-a;break a}b:{switch(ze(a,b)&3){case 0:a=fc(P[b>>3],P[b+8>>3],1);break a;case 1:a=gc(P[b>>3],P[b+8>>3]);break a;case 2:a=-fc(P[b>>3],P[b+8>>3],1);break a;default:break b}}a=-gc(P[b>>3],P[b+8>>3])}sa=b+16|0;return a}function Pe(a){var b=0;K[a+296>>2]=303173648;K[a+300>>2]=370677780;b=K[26341];K[a+304>>2]=K[26340];K[a+308>>2]=b;b=K[26343];K[a+312>>2]=K[26342];K[a+316>>2]=b;md(a);K[a+56>>2]=2;K[a+36>>2]=3;K[a+40>>2]=1074;I[a+168|0]=5;K[a+132>>2]=32;K[a+104>>2]=1032;K[a+108>>2]=66;K[a+8>>2]=5;K[a+12>>2]=32;I[a+365|0]=L[a+365|0]|64;I[a+368|0]=L[a+368|0]|64;I[a+396|0]=L[a+396|0]|64;I[a+399|0]=L[a+399|0]|64}function cd(a,b,c){var d=0,e=0,f=0;d=K[c+16>>2];a:{if(!d){if(ed(c)){break a}d=K[c+16>>2]}f=K[c+20>>2];if(d-f>>>0<b>>>0){return wa[K[c+36>>2]](c,a,b)|0}b:{if(K[c+80>>2]<0){d=0;break b}e=b;while(1){d=e;if(!d){d=0;break b}e=d-1|0;if(L[e+a|0]!=10){continue}break}e=wa[K[c+36>>2]](c,a,d)|0;if(e>>>0<d>>>0){break a}a=a+d|0;b=b-d|0;f=K[c+20>>2]}Fa(f,a,b);K[c+20>>2]=K[c+20>>2]+b;e=b+d|0}return e}function $e(a){var b=0,c=0,d=0;d=K[34064];a:{if((d|0)>0){while(1){b:{c=K[(b<<4)+136284>>2];if(!c){break b}if(Oa(a,c)){break b}if(K[(b<<4)+136276>>2]){return b}c=-1;if(xd(0,b)){break a}return b}b=b+1|0;if((d|0)!=(b|0)){continue}break}}c=-1;if(xd(a,d)){break a}b=yb(K[((K[34064]<<4)+136272|0)+12>>2],Ba(a)+1|0);c=K[34064];K[((c<<4)+136272|0)+12>>2]=b;Ca(b,a);K[34064]=c+1}return c}function Pd(a,b){var c=0,d=0,e=0,f=0,g=0;d=sa-16|0;sa=d;I[b|0]=0;c=K[a>>2]&15;if(c){b=Ca(b,$b(128496,c|64));e=Ba(b);b=e+b|0}c=8;while(1){a:{b:{if(c>>>0<=29){if(K[a>>2]>>>c&1){break b}break a}if(!(K[a+4>>2]>>>c-32&1)|c>>>0<32){break a}}f=$b(128496,c);g=Ba(f)+1|0;e=g+e|0;if((e|0)>=80){break a}K[d>>2]=f;Aa(b,84439,d);b=b+g|0}c=c+1|0;if((c|0)!=64){continue}break}sa=d+16|0}function Ne(a,b,c){var d=0,e=0,f=0,g=0;f=sa-16|0;sa=f;if(L[a|0]){g=K[30450];while(1){e=a;a=a+1|0;d=I[e|0];if((d|0)==32|d-9>>>0<5){continue}d=Kb(e);if((d|0)>0){a:{if((d|0)<32){K[b>>2]=K[b>>2]|1<<d;break a}e=$b(129568,c);K[f+4>>2]=d;K[f>>2]=e;Na(g,84902,f)}e=a}while(1){a=e;e=a+1|0;d=I[a|0];if(d-48>>>0<10|(d|32)-97>>>0<26){continue}break}if(d){continue}break}}sa=f+16|0}function lc(a,b,c){var d=0,e=0,f=0,g=0;a:{if(!b){break a}e=c-4|0;if((e|0)<=0){break a}c=K[b-4>>2];f=(c|0)!=34?(c|0)==39?c:0:c;c=0;while(1){g=c;c=K[b>>2];if(!c){break a}b:{if(!f){if((c|0)==32|c-9>>>0<5){break a}if((c|0)!=47){break b}break a}if((g|0)==92){break b}if((c|0)==(f|0)){break a}}b=b+4|0;d=Pa(c,a+d|0)+d|0;if((e|0)>(d|0)){continue}break}}I[a+d|0]=0;return d}function Ma(a){var b=0;a:{if(pb(a)){break a}b=0;b:{if(a>>>0<768){break b}if(a-2305>>>0<=1270){if((a&124)>>>0<100){break a}b=1;if(rd(93850,a)){break b}return a-3450>>>0<6}if((a|0)==1541|a-1456>>>0<19|(a|0)==1648){break a}b=a&-256;if((b|0)==10240|(b|0)==4352|(a-3904>>>0<125|a>>>0<880)){break a}b=1;if(a-1611>>>0<20){break b}b=a-12353>>>0<30400}return b}return 1}function Ef(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;if(qb(a,K[b+8>>2],e)){if(!(K[b+28>>2]==1|K[b+4>>2]!=(c|0))){K[b+28>>2]=d}return}a:{if(!qb(a,K[b>>2],e)){break a}if(!(K[b+16>>2]!=(c|0)&K[b+20>>2]!=(c|0))){if((d|0)!=1){break a}K[b+32>>2]=1;return}K[b+20>>2]=c;K[b+32>>2]=d;K[b+40>>2]=K[b+40>>2]+1;if(!(K[b+36>>2]!=1|K[b+24>>2]!=2)){I[b+54|0]=1}K[b+44>>2]=4}}function zd(a,b){var c=0;if(!a){Ea(133152,0,76);return}c=K[a+4>>2];if(c){Ca(133208,c)}c=K[a>>2];if(c){La(133168,c,40)}K[33289]=L[a+14|0];K[33291]=L[a+13|0];K[33290]=L[a+12|0];La(134672,L[b|0]!=33|L[b+1|0]!=118?b:(L[b+2|0]==47?3:0)+b|0,40);a=K[50298];K[33678]=K[50297];K[33679]=a;a=K[50302];K[33682]=K[50301];K[33683]=a;a=K[50300];K[33680]=K[50299];K[33681]=a}function Nf(a,b,c){a=a|0;b=b|0;c=c|0;var d=0,e=0,f=0,g=0;d=K[a+84>>2];f=K[d>>2]?d:84412;d=0;a:{if(!K[a+48>>2]){break a}while(1){e=K[(d<<2)+f>>2];if(!e){break a}I[K[a+44>>2]+d|0]=(e|0)>=128?64:e;d=d+1|0;if(d>>>0<N[a+48>>2]){continue}break}}e=K[a+44>>2];K[a+4>>2]=e;K[a+84>>2]=(d<<2)+f;K[a+8>>2]=d+e;if(!(!c|!d)){K[a+4>>2]=e+1;I[b|0]=L[e|0];g=1}return g|0}function Qf(a,b,c){a=a|0;b=b|0;c=c|0;var d=0,e=0,f=0,g=0;e=K[a+84>>2];f=K[e+4>>2];g=K[a+28>>2];d=K[a+20>>2]-g|0;d=d>>>0>f>>>0?f:d;if(d){Fa(K[e>>2],g,d);K[e>>2]=d+K[e>>2];f=K[e+4>>2]-d|0;K[e+4>>2]=f}d=K[e>>2];f=c>>>0>f>>>0?f:c;if(f){Fa(d,b,f);d=f+K[e>>2]|0;K[e>>2]=d;K[e+4>>2]=K[e+4>>2]-f}I[d|0]=0;b=K[a+44>>2];K[a+28>>2]=b;K[a+20>>2]=b;return c|0}function Rd(a,b,c,d){I[a+53|0]=1;a:{if(K[a+4>>2]!=(c|0)){break a}I[a+52|0]=1;c=K[a+16>>2];b:{if(!c){K[a+36>>2]=1;K[a+24>>2]=d;K[a+16>>2]=b;if((d|0)!=1){break a}if(K[a+48>>2]==1){break b}break a}if((b|0)==(c|0)){c=K[a+24>>2];if((c|0)==2){K[a+24>>2]=d;c=d}if(K[a+48>>2]!=1){break a}if((c|0)==1){break b}break a}K[a+36>>2]=K[a+36>>2]+1}I[a+54|0]=1}}function Ob(a,b){var c=0,d=0,e=0,f=0,g=0;c=K[b>>2];a:{if(!c){break a}while(1){d=0;b:{if(!a){break b}while(1){c:{g=I[d+c|0];e=K[(d<<2)+a>>2];if(!e){break c}d=d+1|0;if((g|0)==(e|0)){continue}}break}d:{switch(e-34|0){case 0:case 5:break d;default:break b}}if(!g){break a}}f=f+1|0;c=K[(f<<3)+b>>2];if(c){continue}break}}return K[((f<<3)+b|0)+4>>2]}function Ib(a,b){a:{if((b|0)>=1024){a=a*898846567431158e293;if(b>>>0<2047){b=b-1023|0;break a}a=a*898846567431158e293;b=((b|0)>=3069?3069:b)-2046|0;break a}if((b|0)>-1023){break a}a=a*2004168360008973e-307;if(b>>>0>4294965304){b=b+969|0;break a}a=a*2004168360008973e-307;b=((b|0)<=-2960?-2960:b)+1938|0}z(0,0);z(1,b+1023<<20);return a*+B()}function sb(a,b,c,d){var e=0,f=0,g=0,h=0;f=sa-16|0;sa=f;K[f+12>>2]=d;e=sa-160|0;sa=e;g=b?a:e+158|0;K[e+144>>2]=g;h=-1;a=b-1|0;K[e+148>>2]=a>>>0<=b>>>0?a:0;a=Ea(e,0,144);K[a+76>>2]=-1;K[a+36>>2]=17;K[a+80>>2]=-1;K[a+44>>2]=a+159;K[a+84>>2]=a+144;a:{if((b|0)<0){K[56798]=61;break a}I[g|0]=0;h=ie(a,c,d,15,16)}sa=a+160|0;sa=f+16|0;return h}function If(a,b,c){a=a|0;b=b|0;c=c|0;var d=0,e=0;e=sa+-64|0;sa=e;d=1;a:{if(qb(a,b,0)){break a}d=0;if(!b){break a}b=Td(b,125132);d=0;if(!b){break a}d=e+8|0;Ea(d|4,0,52);K[e+56>>2]=1;K[e+20>>2]=-1;K[e+16>>2]=a;K[e+8>>2]=b;wa[K[K[b>>2]+28>>2]](b,d,K[c>>2],1);a=K[e+32>>2];if((a|0)==1){K[c>>2]=K[e+24>>2]}d=(a|0)==1}sa=e- -64|0;return d|0}function $c(a,b){var c=0,d=0,e=0;c=L[a|0];a:{if(!c){break a}while(1){d=L[b|0];if(!d){e=c;break a}b:{if((c|0)==(d|0)){break b}d=c-65>>>0<26?c|32:c;c=L[b|0];if((d|0)==((c-65>>>0<26?c|32:c)|0)){break b}e=L[a|0];break a}b=b+1|0;c=L[a+1|0];a=a+1|0;if(c){continue}break}}a=e&255;e=a-65>>>0<26?a|32:a;a=L[b|0];return e-(a-65>>>0<26?a|32:a)|0}function dd(a,b,c){var d=0,e=0,f=0;d=K[c+72>>2];K[c+72>>2]=d-1|d;d=K[c+4>>2];e=K[c+8>>2];if((d|0)==(e|0)){d=b}else{f=d;d=e-d|0;d=b>>>0>d>>>0?d:b;Fa(a,f,d);K[c+4>>2]=d+K[c+4>>2];a=a+d|0;d=b-d|0}if(d){while(1){a:{if(!fd(c)){e=wa[K[c+32>>2]](c,a,d)|0;if(e){break a}}return b-d|0}a=a+e|0;d=d-e|0;if(d){continue}break}}return b}function Kb(a){var b=0,c=0,d=0,e=0;while(1){b=a;a=b+1|0;c=I[b|0];if((c|0)==32|c-9>>>0<5){continue}break}a:{b:{c:{c=I[b|0];switch(c-43|0){case 0:break b;case 2:break c;default:break a}}e=1}c=I[a|0];b=a}if(c-48>>>0<10){while(1){d=(Q(d,10)-I[b|0]|0)+48|0;a=I[b+1|0];b=b+1|0;if(a-48>>>0<10){continue}break}}return e?d:0-d|0}function ld(a,b){var c=0,d=0,e=0,f=0;c=sa-32|0;sa=c;K[b>>2]=0;K[b+4>>2]=0;e=b+24|0;d=e;K[d>>2]=0;K[d+4>>2]=0;f=b+16|0;d=f;K[d>>2]=0;K[d+4>>2]=0;d=b+8|0;K[d>>2]=0;K[d+4>>2]=0;K[c+28>>2]=b+28;K[c+24>>2]=e;K[c+20>>2]=b+20;K[c+16>>2]=f;K[c+12>>2]=b+12;K[c+8>>2]=d;K[c+4>>2]=b+4;K[c>>2]=b;a=Ka(a,84553,c);sa=c+32|0;return a}function We(a){var b=0,c=0,d=0;b=L[a|0];a:{if(!b){break a}c=L[a+1|0];if(!c){c=b;break a}c=b|c<<8;b=L[a+2|0];if(!b){break a}c=b<<16|c;a=L[a+3|0];if(!a){break a}c=a<<24|c}b=K[36115];if((b|0)>0){a=0;while(1){d=K[(a<<2)+144464>>2];if(!(!d|K[d>>2]!=(c|0))){return L[d+10|0]}a=a+1|0;if((b|0)!=(a|0)){continue}break}}return 0}function ad(a,b,c,d){var e=0,f=0,g=0,h=0,i=0,j=0;g=sa-240|0;sa=g;K[g>>2]=a;h=1;a:{if((c|0)<2){break a}e=a;while(1){e=e-4|0;i=c-2|0;f=e-K[(i<<2)+d>>2]|0;if((Jb(a,f,b)|0)>=0){if((Jb(a,e,b)|0)>=0){break a}}j=f;f=(Jb(f,e,b)|0)>=0;e=f?j:e;K[(h<<2)+g>>2]=e;h=h+1|0;c=f?c-1|0:i;if((c|0)>1){continue}break}}pe(g,h);sa=g+240|0}function Aa(a,b,c){var d=0,e=0,f=0,g=0;f=sa-16|0;sa=f;K[f+12>>2]=c;d=sa-160|0;sa=d;g=d+8|0;Fa(g,124528,144);K[d+52>>2]=a;K[d+28>>2]=a;e=-2-a|0;e=e>>>0>2147483647?2147483647:e;K[d+56>>2]=e;a=a+e|0;K[d+36>>2]=a;K[d+24>>2]=a;a=Yc(g,b,c);if(e){b=K[d+28>>2];I[b-((b|0)==K[d+24>>2])|0]=0}sa=d+160|0;sa=f+16|0;return a}function pe(a,b){var c=0,d=0,e=0,f=0,g=0,h=0;c=4;f=sa-256|0;sa=f;if((b|0)>=2){h=(b<<2)+a|0;K[h>>2]=f;while(1){e=c>>>0>=256?256:c;Fa(K[h>>2],K[a>>2],e);d=0;while(1){g=(d<<2)+a|0;d=d+1|0;Fa(K[g>>2],K[(d<<2)+a>>2],e);K[g>>2]=K[g>>2]+e;if((b|0)!=(d|0)){continue}break}c=c-e|0;if(c){continue}break}}sa=f+256|0}function Da(a,b,c){var d=0,e=0;d=sa-96|0;sa=d;K[d+88>>2]=0;K[d+92>>2]=1073741824;K[d+84>>2]=b;b=Wa(a,d+84|0,c,d+88|0,2,0);e=K[d+88>>2];a:{if(!(e&536870912)){a=b?e:0;break a}b=K[47202];K[47202]=0;I[d+2|0]=32;J[d>>1]=8192;e=d|3;La(e,K[d+84>>2],77);a=jc(a,e,0,0);Ca(c,189088);K[47202]=b}sa=d+96|0;return a}function Ec(a,b,c){var d=0,e=0,f=0;e=kc(a);d=K[b>>2];a:{b:{if((e|0)>=0){if(d){if(!Oa(a,c)){break b}f=K[d+688>>2];if(f){Ha(f)}Ha(d);K[b>>2]=0}K[b>>2]=nd(a);a=Ca(c,a);c=K[b>>2];if(Od(c,c+228|0,0)){ab(K[K[32972]+60>>2]);I[a|0]=0;e=-1}d=K[b>>2];K[d+292>>2]=e;break b}if(!d){break a}}I[d+268|0]=0}return e}function wc(a){var b=0,c=0;b=K[a+76>>2];if(!((b|0)>=0&(!b|K[56823]!=(b&-1073741825)))){b=K[a+4>>2];if((b|0)!=K[a+8>>2]){K[a+4>>2]=b+1;return L[b|0]}return xc(a)}b=a+76|0;c=K[b>>2];K[b>>2]=c?c:1073741823;c=K[a+4>>2];a:{if((c|0)!=K[a+8>>2]){K[a+4>>2]=c+1;a=L[c|0];break a}a=xc(a)}K[b>>2]=0;return a}function $a(a,b,c){var d=0,e=0;a:{b:{if(c>>>0>=4){if((a|b)&3){break b}while(1){if(K[a>>2]!=K[b>>2]){break b}b=b+4|0;a=a+4|0;c=c-4|0;if(c>>>0>3){continue}break}}if(!c){break a}}while(1){d=L[a|0];e=L[b|0];if((d|0)==(e|0)){b=b+1|0;a=a+1|0;c=c-1|0;if(c){continue}break a}break}return d-e|0}return 0}function gb(a,b){var c=0,d=0,e=0,f=0;d=sa-16|0;sa=d;a:{if(!b){b=0;break a}c=b>>31;e=(c^b)-c|0;c=T(e);Xa(d,e,0,0,0,c+81|0);e=0+K[d+8>>2]|0;c=(K[d+12>>2]^65536)+(16414-c<<16)|0;c=e>>>0<f>>>0?c+1|0:c;f=b&-2147483648|c;c=K[d+4>>2];b=K[d>>2]}K[a>>2]=b;K[a+4>>2]=c;K[a+8>>2]=e;K[a+12>>2]=f;sa=d+16|0}function ec(a){var b=0,c=0,d=0,e=0;b=_c(a,61);if((b|0)==(a|0)){return 0}d=b-a|0;a:{if(L[d+a|0]){break a}b=K[56800];if(!b){break a}c=K[b>>2];if(!c){break a}while(1){b:{if(!le(a,c,d)){c=K[b>>2]+d|0;if(L[c|0]==61){break b}}c=K[b+4>>2];b=b+4|0;if(c){continue}break a}break}e=c+1|0}return e}function kc(a){var b=0,c=0;a:{c=K[34461];if((c|0)<=0){break a}while(1){if(!Oa(a,Q(b,44)+137856|0)){K[34457]=b;break a}b=b+1|0;if((c|0)!=(b|0)){continue}break}return-1}a=(b|0)==(c|0);if(a){return-1}a=a?-1:b;if((a|0)!=K[36114]){K[36115]=0;vd(a);K[36114]=a;K[36115]=K[36115]+1}return b}function od(a,b,c,d){var e=0,f=0;a:{if((L[b|0]|32)==32){break a}e=((d|0)>2)<<1;e=(d|0)>1?e|4:e;f=pd(a,b,c,e);if(L[c|0]!=21){e=e|1;b=b+f|0;f=1;while(1){if((L[b|0]|32)==32){break a}b=pd(a,b,c,e)+b|0;f=f+1|0;if(L[c|0]!=21){continue}break}}Ca(189088,c);return 0}Fd(a,c,d,f);return b}function Lf(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;var g=0;g=sa-32|0;sa=g;a:{if(d|e|f|c){K[g+24>>2]=0;K[g+28>>2]=0;K[g+16>>2]=0;K[g+20>>2]=0;K[g+12>>2]=c;K[g+8>>2]=b;I[g+22|0]=f;I[g+21|0]=e;I[g+20|0]=d;b=ac(g+8|0);break a}b=bc(b)}K[a+16>>2]=201188;sa=g+32|0;return b|0}function Pa(a,b){var c=0,d=0,e=0,f=0;if(a>>>0<=127){I[b|0]=a;return 1}if(a>>>0>=1114112){I[b|0]=32;return 1}c=a>>>0<2048?1:a>>>0<65536?2:3;d=Q(c,6);I[b|0]=L[c+93842|0]|a>>>d;while(1){e=e+1|0;d=d-6|0;I[e+b|0]=a>>>d&63|128;f=f+1|0;if((f|0)!=(c|0)){continue}break}return c+1|0}function ne(a){var b=0,c=0;b=K[a+12>>2];a:{if((b|0)>=K[a+16>>2]){b=0;c=na(K[a+8>>2],a+24|0,2048)|0;if((c|0)<=0){if(!c|(c|0)==-44){break a}K[56798]=0-c;return 0}K[a+16>>2]=c}c=b;b=a+b|0;K[a+12>>2]=c+M[b+40>>1];c=K[b+36>>2];K[a>>2]=K[b+32>>2];K[a+4>>2]=c;b=b+24|0}return b}function Nd(a,b){var c=0,d=0;c=K[a+632>>2];if(c){return(Ta(c,b)|0)!=0}d=K[a+600>>2];a:{b:{if((d|0)>0){c=0;b=b-d|0;if(b-1>>>0<255){break b}break a}c=b-192|0;if(c>>>0<=413){return L[(L[c+94240|0]+a|0)+344|0]&128}c=0;if(b>>>0>255){break a}}c=L[(a+b|0)+344|0]&128}return c}function fc(a,b,c){var d=0,e=0,f=0;d=a*a;f=d*(d*d)*(d*1.58969099521155e-10+-2.5050760253406863e-8)+(d*(d*27557313707070068e-22+-.0001984126982985795)+.00833333333332249);e=d*a;if(!c){return e*(d*f+-.16666666666666632)+a}return a-(d*(b*.5-f*e)-b+e*.16666666666666632)}function cf(){var a=0,b=0;a=sa-16|0;sa=a;a:{if(pa(a+12|0,a+8|0)|0){break a}b=Qa((K[a+12>>2]<<2)+4|0);K[56800]=b;if(!b){break a}b=Qa(K[a+8>>2]);if(b){K[K[56800]+(K[a+12>>2]<<2)>>2]=0;if(!(oa(K[56800],b|0)|0)){break a}}K[56800]=0}sa=a+16|0;K[56841]=227236;K[56823]=42}function Tb(a,b){var c=0,d=0,e=0,f=0;c=sa-16|0;sa=c;a:{if(!b){b=0;break a}d=b;b=T(b);Xa(c,d,0,0,0,b+81|0);d=0+K[c+8>>2]|0;b=(K[c+12>>2]^65536)+(16414-b<<16)|0;f=e>>>0>d>>>0?b+1|0:b;e=K[c+4>>2];b=K[c>>2]}K[a>>2]=b;K[a+4>>2]=e;K[a+8>>2]=d;K[a+12>>2]=f;sa=c+16|0}function Mf(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;var f=0;f=sa-32|0;sa=f;a:{if(d|e|c){K[f+24>>2]=0;K[f+28>>2]=0;K[f+16>>2]=0;K[f+20>>2]=0;K[f+12>>2]=c;K[f+8>>2]=b;I[f+21|0]=e;I[f+20|0]=d;b=ac(f+8|0);break a}b=bc(b)}K[a+16>>2]=201188;sa=f+32|0;return b|0}function ue(a){var b=0,c=0,d=0;c=sa-16|0;sa=c;I[c+15|0]=10;b=K[a+16>>2];a:{if(!b){if(ed(a)){break a}b=K[a+16>>2]}d=b;b=K[a+20>>2];if(!((d|0)==(b|0)|K[a+80>>2]==10)){K[a+20>>2]=b+1;I[b|0]=10;break a}if((wa[K[a+36>>2]](a,c+15|0,1)|0)!=1){break a}}sa=c+16|0}function fd(a){var b=0,c=0;b=K[a+72>>2];K[a+72>>2]=b-1|b;if(K[a+20>>2]!=K[a+28>>2]){wa[K[a+36>>2]](a,0,0)|0}K[a+28>>2]=0;K[a+16>>2]=0;K[a+20>>2]=0;b=K[a>>2];if(b&4){K[a>>2]=b|32;return-1}c=K[a+44>>2]+K[a+48>>2]|0;K[a+8>>2]=c;K[a+4>>2]=c;return b<<27>>31}function bc(a){var b=0;a:{b:{c:{a=Le(a);d:{if((a|0)<=268437502){if(!a){break a}if((a|0)==268436479){break b}if((a|0)!=268437247){break d}return 2}if((a|0)==268437503|(a|0)==268437759){break c}if((a|0)==268439295){break a}}return-1}return 2}b=1}return b}function Ba(a){var b=0,c=0,d=0;b=a;a:{if(b&3){while(1){if(!L[b|0]){break a}b=b+1|0;if(b&3){continue}break}}while(1){c=b;b=b+4|0;d=K[c>>2];if(!((d^-1)&d-16843009&-2139062144)){continue}break}while(1){b=c;c=b+1|0;if(L[b|0]){continue}break}}return b-a|0}function lb(a,b,c){var d=0,e=0,f=0,g=0;K[a+112>>2]=b;K[a+116>>2]=c;e=K[a+4>>2];d=K[a+44>>2]-e|0;K[a+120>>2]=d;K[a+124>>2]=d>>31;d=K[a+8>>2];a:{if(!(b|c)){break a}f=d-e|0;g=f>>31;if((c|0)>=(g|0)&b>>>0>=f>>>0|(c|0)>(g|0)){break a}d=b+e|0}K[a+104>>2]=d}function je(a,b){var c=0,d=0,e=0;C(+a);d=x(1)|0;e=x(0)|0;c=d>>>20&2047;if((c|0)!=2047){if(!c){if(a==0){c=0}else{a=je(a*0x10000000000000000,b);c=K[b>>2]+-64|0}K[b>>2]=c;return a}K[b>>2]=c-1022;z(0,e|0);z(1,d&-2146435073|1071644672);a=+B()}return a}function Pf(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=sa-32|0;sa=e;a:{if(c|d){K[e+24>>2]=0;K[e+28>>2]=0;K[e+16>>2]=0;K[e+20>>2]=0;K[e+12>>2]=c;K[e+8>>2]=b;I[e+22|0]=0;I[e+20|0]=d;b=ac(e+8|0);break a}b=bc(b)}K[a+16>>2]=201188;sa=e+32|0;return b|0}function te(a,b,c){a:{if(K[a+20>>2]!=K[a+28>>2]){wa[K[a+36>>2]](a,0,0)|0;if(!K[a+20>>2]){break a}}K[a+28>>2]=0;K[a+16>>2]=0;K[a+20>>2]=0;wa[K[a+40>>2]](a,b,c,0)|0;if((va|0)<0){break a}K[a+4>>2]=0;K[a+8>>2]=0;K[a>>2]=K[a>>2]&-17;return 0}return-1}function gc(a,b){var c=0,d=0,e=0,f=0;c=a*a;d=c*.5;e=1-d;f=1-e-d;d=c*c;return e+(f+(c*(c*(c*(c*2480158728947673e-20+-.001388888888887411)+.0416666666666666)+d*d*(c*(c*-11359647557788195e-27+2.087572321298175e-9)+-2.7557314351390663e-7))-a*b))}function Vb(a,b,c){var d=0,e=0;if(b){while(1){c=c-1|0;e=a;a=wg(a,b,10);d=va;I[c|0]=e-vg(a,d,10,0)|48;e=b>>>0>9;b=d;if(e){continue}break}}if(a){while(1){c=c-1|0;b=(a>>>0)/10|0;I[c|0]=a-Q(b,10)|48;d=a>>>0>9;a=b;if(d){continue}break}}return c}function Ze(a,b){var c=0,d=0,e=0;a:{if(!a){break a}while(1){b:{e=I[b+c|0];d=K[(c<<2)+a>>2];if(!d){break b}c=c+1|0;if((e|0)==(d|0)){continue}}break}c:{switch(d-34|0){case 0:case 5:break c;default:break a}}if(e){break a}return 0}return 1}function re(a,b,c){var d=0,e=0;d=sa-16|0;sa=d;a:{if(!(b&64)){e=0;if((b&4259840)!=4259840){break a}}K[d+12>>2]=c+4;e=K[c>>2]}K[d>>2]=e;K[d+4>>2]=0;a=ba(-100,a|0,b|32768,d|0)|0;if(a>>>0>=4294963201){K[56798]=0-a;a=-1}sa=d+16|0;return a}function le(a,b,c){var d=0,e=0,f=0;if(!c){return 0}d=L[a|0];a:{if(!d){break a}while(1){b:{e=L[b|0];if(!e){break b}c=c-1|0;if(!c|(d|0)!=(e|0)){break b}b=b+1|0;d=L[a+1|0];a=a+1|0;if(d){continue}break a}break}f=d}return(f&255)-L[b|0]|0}function ud(a,b){var c=0,d=0;c=sa-128|0;sa=c;c=Ea(c,0,128);I[c+98|0]=9;I[c+66|0]=9;I[c+34|0]=a;J[c+68>>1]=1;d=K[36125];K[c+104>>2]=d;K[c+72>>2]=d;K[c+40>>2]=K[(a<<2)+144464>>2];I[c+2|0]=9;K[c+8>>2]=d;bb(0,0,c+32|0,b,0);sa=c+128|0}function ge(a){var b=0,c=0,d=0;if(I[K[a>>2]]-48>>>0>=10){return 0}while(1){d=K[a>>2];c=-1;if(b>>>0<=214748364){c=I[d|0]-48|0;b=Q(b,10);c=(c|0)>(b^2147483647)?-1:c+b|0}K[a>>2]=d+1;b=c;if(I[d+1|0]-48>>>0<10){continue}break}return b}function Xe(a,b){var c=0;a:{if(!a|K[a>>2]-48>>>0>=10){break a}if(K[a>>2]-48>>>0<10){while(1){c=(K[a>>2]+Q(c,10)|0)-48|0;a=a+4|0;if(K[a>>2]-48>>>0<10){continue}break}}if((b|0)!=1){break a}c=(xb(K[a>>2])|0)==115?Q(c,1e3):c}return c}function Sa(a){var b=0;b=1;a:{b:{switch(Bb(a)|0){case 30:b=0;if((a|0)==160|(a|0)==8199|(a|0)==8239){break a}return 1;case 0:if(a-9>>>0<5){return 1}if((a|0)==133){break a}break;case 28:case 29:break a;default:break b}}b=0}return b}function Tf(a,b,c){a=a|0;b=b|0;c=c|0;var d=0;d=sa-32|0;sa=d;a:{if(c){K[d+24>>2]=0;K[d+28>>2]=0;K[d+16>>2]=0;K[d+20>>2]=0;K[d+12>>2]=c;K[d+8>>2]=b;I[d+21|0]=0;b=ac(d+8|0);break a}b=bc(b)}K[a+16>>2]=201188;sa=d+32|0;return b|0}function Hd(a,b,c){var d=0,e=0;d=sa-16|0;sa=d;I[d+6|0]=0;I[d+7|0]=95;e=b;b=d+8|0;e=Pa(e,b)+d|0;I[e+8|0]=32;I[e+9|0]=0;a:{if(Da(a,d+7|0,c)){break a}I[d+7|0]=32;if(Da(a,b,c)){break a}jb(a,b,c,20,0,0,0)}sa=d+16|0;return I[c|0]}function Gd(a){var b=0,c=0;c=170;a:{if((a|0)<170){break a}while(1){if((a|0)==(c|0)){return M[(b<<1|2)+101616>>1]}b=b+2|0;if((b&2147483646)==124){break a}c=M[(b<<1)+101616>>1];if((c|0)<=(a|0)){continue}break}}return 0}function vg(a,b,c,d){var e=0,f=0,g=0,h=0,i=0,j=0;e=c>>>16|0;f=a>>>16|0;j=Q(e,f);g=c&65535;h=a&65535;i=Q(g,h);f=(i>>>16|0)+Q(f,g)|0;e=(f&65535)+Q(e,h)|0;va=(Q(b,c)+j|0)+Q(a,d)+(f>>>16)+(e>>>16)|0;return i&65535|e<<16}function xb(a){var b=0,c=0,d=0,e=0;b=2778;while(1){d=(b+e|0)/2|0;c=K[(d<<4)+1040>>2];if((c|0)==(a|0)){b=K[(d<<4)+1048>>2];return b?b:a}c=a>>>0>c>>>0;e=c?d+1|0:e;b=c?b:d-1|0;if((e|0)<=(b|0)){continue}break}return a}function Vc(a){var b=0,c=0,d=0,e=0;b=2778;while(1){d=(b+e|0)/2|0;c=K[(d<<4)+1040>>2];if((c|0)==(a|0)){b=K[(d<<4)+1044>>2];return b?b:a}c=a>>>0>c>>>0;e=c?d+1|0:e;b=c?b:d-1|0;if((e|0)<=(b|0)){continue}break}return a}function vb(a){var b=0,c=0;b=sa-112|0;sa=b;a=ka(a|0,b|0)|0;if(a>>>0>=4294963201){K[56798]=0-a;a=-1}c=0-K[56798]|0;a:{if(a){break a}c=-31;if((K[b+12>>2]&61440)==16384){break a}c=K[b+40>>2]}a=c;sa=b+112|0;return a}function Sd(a,b,c){var d=0;d=K[a+16>>2];if(!d){K[a+36>>2]=1;K[a+24>>2]=c;K[a+16>>2]=b;return}a:{if((b|0)==(d|0)){if(K[a+24>>2]!=2){break a}K[a+24>>2]=c;return}I[a+54|0]=1;K[a+24>>2]=2;K[a+36>>2]=K[a+36>>2]+1}}function Ya(a,b,c,d,e){var f=0;f=sa-256|0;sa=f;if(!(e&73728|(c|0)<=(d|0))){d=c-d|0;c=d>>>0<256;Ea(f,b&255,c?d:256);if(!c){while(1){Va(a,f,256);d=d-256|0;if(d>>>0>255){continue}break}}Va(a,f,d)}sa=f+256|0}function zb(a,b,c){var d=0;a:{if(a){d=K[a>>2];if(d){Ha(K[d+4>>2]);d=K[a>>2];break a}d=Qa(16);K[a>>2]=d;if(d){break a}b=48}return b}K[d>>2]=0;K[d+4>>2]=oc(c);a=K[a>>2];K[a+8>>2]=0;K[a+12>>2]=0;return b}function _a(a){var b=0,c=0;yc(a);wa[K[a+12>>2]](a)|0;if(!(I[a|0]&1)){b=K[a+52>>2];if(b){K[b+56>>2]=K[a+56>>2]}c=K[a+56>>2];if(c){K[c+52>>2]=b}if(K[56816]==(a|0)){K[56816]=c}Ha(K[a+96>>2]);Ha(a)}}function wb(a){var b=0,c=0;b=1;a:{b:{c:{d:{c=Bb(a);switch(c-9|0){case 1:break a;case 6:case 18:break c;case 0:break d;default:break b}}return(xb(a)|0)!=(a|0)}return Rb(a,c)>>>15&1}b=0}return b}function Ad(a){var b=0,c=0,d=0,e=0,f=0;e=Ba(a)+1|0;b=K[33282];c=K[33287];d=c+e|0;if((d|0)>=K[33286]){f=d+1e3|0;b=yb(b,f);if(!b){return-1}K[33286]=f;K[33282]=b}Fa(b+c|0,a,e);K[33287]=d;return c}function bg(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=sa-16|0;sa=e;a=ha(K[a+60>>2],b|0,c|0,d&255,e+8|0)|0;if(a){K[56798]=a;a=-1}else{a=0}sa=e+16|0;va=a?-1:K[e+12>>2];return(a?-1:K[e+8>>2])|0}function mg(a,b){a=a|0;b=b|0;var c=0,d=0,e=0;a=K[a>>2];c=K[a+4>>2];d=K[b>>2];e=K[d+4>>2];b=Oa(c+1|0,e+1|0);a:{if(b){break a}b=I[c|0]-I[e|0]|0;if(b){break a}b=Oa(K[a>>2],K[d>>2])}return b|0}function ed(a){var b=0;b=K[a+72>>2];K[a+72>>2]=b-1|b;b=K[a>>2];if(b&8){K[a>>2]=b|32;return-1}K[a+4>>2]=0;K[a+8>>2]=0;b=K[a+44>>2];K[a+28>>2]=b;K[a+20>>2]=b;K[a+16>>2]=b+K[a+48>>2];return 0}function $d(a,b,c,d){a:{if(!a){break a}b:{switch(b+2|0){case 0:I[a|0]=c;return;case 1:J[a>>1]=c;return;case 2:case 3:K[a>>2]=c;return;case 5:break b;default:break a}}K[a>>2]=c;K[a+4>>2]=d}}function Xc(a,b,c,d,e,f,g,h,i){var j=0;j=sa-16|0;sa=j;cb(j,b,c,d,e,f,g,h,i^-2147483648);d=K[j>>2];c=K[j+4>>2];b=K[j+12>>2];K[a+8>>2]=K[j+8>>2];K[a+12>>2]=b;K[a>>2]=d;K[a+4>>2]=c;sa=j+16|0}function Wf(a,b,c){a=a|0;b=b|0;c=c|0;K[34440]=0;a=Cb(c,1032);if(!a){return-1}K[47195]=a;K[47197]=130;if(!a){K[47195]=K[30450]}Jd(b);K[47195]=0;K[47197]=0;K[47195]=K[30450];_a(a);return 0}function kf(a){a=a|0;var b=0,c=0;b=K[a>>2];c=Kd(a);a:{if((c|0)!=65533){break a}K[a>>2]=b+1;K[a+8>>2]=1;b=I[b|0];c=b&255;if((b|0)>=0){break a}c=M[(K[a+12>>2]+(c<<1)|0)-256>>1]}return c|0}function Of(a,b,c){a=a|0;b=b|0;c=c|0;var d=0,e=0,f=0;e=K[a+84>>2];d=c+256|0;f=Wb(e,0,d);d=f?f-e|0:d;c=c>>>0>d>>>0?d:c;Fa(b,e,c);b=e+d|0;K[a+84>>2]=b;K[a+8>>2]=b;K[a+4>>2]=c+e;return c|0}function Oa(a,b){var c=0,d=0;c=L[a|0];d=L[b|0];a:{if(!c|(c|0)!=(d|0)){break a}while(1){d=L[b+1|0];c=L[a+1|0];if(!c){break a}b=b+1|0;a=a+1|0;if((c|0)==(d|0)){continue}break}}return c-d|0}function $b(a,b){var c=0,d=0,e=0;c=K[a>>2];if(!c){return 84399}if(K[a+4>>2]!=(b|0)){while(1){d=a+8|0;c=K[d>>2];if(!c){return 84399}e=a;a=d;if(K[e+12>>2]!=(b|0)){continue}break}}return c}function Zd(a,b,c){var d=0,e=0,f=0;a:{if(!c){break a}while(1){d=K[b>>2];e=K[a>>2];if(!(!d|!e|(d|0)!=(e|0))){b=b+4|0;a=a+4|0;c=c-1|0;if(c){continue}break a}break}f=e-d|0}return f}function eb(a){var b=0,c=0,d=0;d=K[36115];if((d|0)>0){while(1){c=K[(b<<2)+144464>>2];if(!(!c|K[c>>2]!=(a|0))){return L[c+10|0]}b=b+1|0;if((d|0)!=(b|0)){continue}break}}return 0}function Ub(a){var b=0,c=0;b=K[33175];c=a+7&-8;a=b+c|0;a:{if(a>>>0<=b>>>0?c:0){break a}if(a>>>0>xa()<<16>>>0){if(!(ja(a|0)|0)){break a}}K[33175]=a;return b}K[56798]=48;return-1}function Sb(a){var b=0;a:{b=Bb(a);if(b>>>0>27){break a}if(!(1<<b&134259072)){if((b|0)==6){return 1}if((b|0)!=9){break a}return(Vc(a)|0)!=(a|0)}return Rb(a,b)>>>14&1}return 0}function Bd(a,b){var c=0;I[a|0]=b>>>24;c=(b>>>0>16777215)+a|0;I[c|0]=b>>>16;c=c+((b&16711680)!=0)|0;I[c|0]=b>>>8;c=c+((b&65280)!=0)|0;I[c|0]=b;I[c+((b&255)!=0)|0]=0;return a}function Nc(a,b){a:{a=_b(a,b);if((a|0)<=268437502){if(!a|(a|0)==268436479|(a|0)!=268437247){break a}return}if((a|0)==268437503|(a|0)==268437759|(a|0)==268439295){break a}}}function qe(a){var b=0;b=K[a>>2]-1|0;b=I[(Q(0-b&b,124511785)>>>27|0)+121600|0];if(!b){a=K[a+4>>2];a=I[(Q(0-a&a,124511785)>>>27|0)+121600|0];b=a?a+32|0:0}return b}function nc(a){var b=0,c=0,d=0;a:{b:{b=Bb(a);if(b>>>0>27){break b}d=1<<b;c=1;if(d&116672){break a}if(!(d&134227968)){break b}return Rb(a,b)>>>10&1}c=0}return c}function pb(a){var b=0,c=0,d=0;a:{b:{b=Bb(a);if(b>>>0>27){break b}d=1<<b;c=1;if(d&34752){break a}if(!(d&134227968)){break b}return Rb(a,b)>>>10&1}c=0}return c}function ff(a){a=a|0;var b=0,c=0,d=0;b=K[a+4>>2];c=K[a>>2];d=c+1|0;if(b>>>0<=d>>>0){K[a>>2]=b;return 65533}K[a>>2]=d;b=L[c|0];K[a>>2]=c+2;return b|L[c+1|0]<<8}function id(){var a=0,b=0;b=K[56797];if(b){a=K[b+8>>2];if(a){wa[K[K[a>>2]+12>>2]](a)}a=K[b+4>>2];if(a){wa[K[K[a>>2]+16>>2]](a)}Ha(b)}K[56797]=0;K[56797]=Ce()}function Wd(a,b){var c=0,d=0;a:{if(!a){break a}c=vg(a,0,b,0);d=va;if((a|b)>>>0<65536){break a}c=d?-1:c}a=Qa(c);if(!(!a|!(L[a-4|0]&3))){Ea(a,0,c)}return a}function yd(a,b){var c=0,d=0;c=(b|0)/100|0;d=K[(b-Q(c,100)<<2)+130128>>2];K[a+100>>2]=d;K[a+96>>2]=d;if(b+99>>>0>=199){K[a+100>>2]=K[(c<<2)+130128>>2]}}function Ue(a){var b=0;b=Qa(1344);if(!b){return}a=Fa(b,a,1344);b=(K[50758]<<4)+216192|0;K[b>>2]=11;K[b+8>>2]=a;a=K[50758]+1|0;K[50758]=(a|0)<=169?a:0}function Cf(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;if(qb(a,K[b+8>>2],f)){Rd(b,c,d,e);return}a=K[a+8>>2];wa[K[K[a>>2]+20>>2]](a,b,c,d,e,f)}function ub(a,b){var c=0;c=K[a>>2];a:{if(!c){break a}while(1){if(b){if(!Oa(b,c)){break a}}a=a+8|0;c=K[a>>2];if(c){continue}break}}return K[a+4>>2]}function xc(a){var b=0,c=0;b=sa-16|0;sa=b;c=-1;a:{if(fd(a)){break a}if((wa[K[a+32>>2]](a,b+15|0,1)|0)!=1){break a}c=L[b+15|0]}sa=b+16|0;return c}function Xf(a,b,c){a=a|0;b=b|0;c=c|0;K[34440]=c;Nc(3,K[a+12>>2]);Nc(1,K[a+8>>2]);a=K[a+16>>2];a:{if(a){ac(a);break a}bc(1024)}Jd(b);K[34440]=0}function Ta(a,b){var c=0,d=0;if(b){while(1){d=a;c=K[a>>2];if(c){a=d+4|0;if((b|0)!=(c|0)){continue}}break}return c?d:0}return(_d(a)<<2)+a|0}function rd(a,b){var c=0,d=0;c=M[a>>1];if(c){while(1){d=d+1|0;if((b|0)==(c|0)){return d}c=M[(d<<1)+a>>1];if(c){continue}break}}return 0}
      function rc(a,b){var c=0,d=0;a:{if(b>>>0<=31){d=K[a>>2];c=a+4|0;break a}b=b-32|0;c=a}c=K[c>>2];K[a>>2]=d<<b;K[a+4>>2]=c<<b|d>>>32-b}function tc(a,b){var c=0,d=0;c=K[a+4>>2];a:{if(b>>>0<=31){d=K[a>>2];break a}b=b-32|0;d=c;c=0}K[a+4>>2]=c>>>b;K[a>>2]=c<<32-b|d>>>b}function hf(a){a=a|0;var b=0,c=0;b=K[a>>2];K[a>>2]=b+1;c=I[b|0];b=c&255;if((c|0)<0){b=M[(K[a+12>>2]+(b<<1)|0)-256>>1]}return b|0}function Gf(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;if(qb(a,K[b+8>>2],0)){Sd(b,c,d);return}a=K[a+8>>2];wa[K[K[a>>2]+28>>2]](a,b,c,d)}function fb(a){var b=0;a=a?a:1;a:{while(1){b=Qa(a);if(b){break a}b=K[57276];if(b){wa[b|0]();continue}break}ia();D()}return b}function lg(a,b){a=a|0;b=b|0;var c=0;b=K[b>>2];c=K[a>>2];a=K[b+16>>2]-K[c+16>>2]|0;if(!a){a=Oa(K[c>>2],K[b>>2])}return a|0}function Rf(a,b){a=a|0;b=b|0;var c=0;c=b;b=K[b>>2]+7&-8;K[c>>2]=b+16;P[a>>3]=Wc(K[b>>2],K[b+4>>2],K[b+8>>2],K[b+12>>2])}function uc(a){if(a>>>0<=131071){return L[(a>>>3&31|L[(a>>>8|0)+117424|0]<<5)+117424|0]>>>(a&7)&1}return a>>>0<196606}function ee(a,b,c,d,e,f,g,h,i){K[a>>2]=b;K[a+4>>2]=c;K[a+8>>2]=d;K[a+12>>2]=e&65535|(i>>>16&32768|e>>>16&32767)<<16}function hg(a){a=a|0;var b=0;K[a>>2]=132304;b=K[a+28>>2];if(b){Ha(b)}b=K[a+32>>2];if(b){Ha(b)}Fe(a+4|0);return a|0}function qb(a,b,c){if(!c){return K[a+4>>2]==K[b+4>>2]}if((a|0)==(b|0)){return 1}return!Oa(K[a+4>>2],K[b+4>>2])}function gg(a){a=a|0;var b=0;K[a>>2]=132304;b=K[a+28>>2];if(b){Ha(b)}b=K[a+32>>2];if(b){Ha(b)}Fe(a+4|0);Ha(a)}function me(a){var b=0;b=ma(-100,a|0,0)|0;if((b|0)==-31){b=la(a|0)|0}if(b>>>0>=4294963201){K[56798]=0-b}}function hd(){var a=0;a=Qa(84)+80|0;K[a>>2]=125420;K[a>>2]=125380;K[a>>2]=125400;ra(a|0,125512,9);D()}function Sc(a){var b=0,c=0;b=wc(a);c=wc(a);return wc(a)<<16&16711680|(c<<8&65280|b&255)|wc(a)<<24}function Pb(a){var b=0;if(!a){return 0}b=1;if(!(a-9472>>>0<160|a-65529>>>0<7)){b=Sa(a)}return b}function Bf(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;if(qb(a,K[b+8>>2],f)){Rd(b,c,d,e)}}function se(a,b){var c=0;c=b>>31;a:{if(K[a+76>>2]<0){a=te(a,b,c);break a}a=te(a,b,c)}return a}function ef(a){a=a|0;var b=0;b=a;a=K[a>>2];K[b>>2]=a+1;a=I[a|0];return((a|0)<0?65533:a&255)|0}function _d(a){var b=0,c=0;c=a;while(1){b=c;c=b+4|0;if(K[b>>2]){continue}break}return b-a>>2}function Ve(a,b){I[a|0]=b;I[a+4|0]=0;I[a+3|0]=b>>>24;I[a+2|0]=b>>>16;I[a+1|0]=b>>>8;return a}function yg(a,b){var c=0,d=0;c=b&31;d=(-1>>>c&a)<<c;c=a;a=0-b&31;return d|(c&-1<<a)>>>a}
      function dc(a,b){var c=0;a:{if((a|0)==73){c=305;if(L[b+173|0]){break a}}c=xb(a)}return c}function ab(a){if(K[36114]!=(a|0)){K[36115]=0;vd(a);K[36114]=a;K[36115]=K[36115]+1}}function wd(a){if(!a){bd(85328,20,K[30450]);return K[32320]}return K[34460]+a|0}function oc(a){var b=0,c=0;b=Ba(a)+1|0;c=Qa(b);if(!c){return 0}return Fa(c,a,b)}function af(){var a=0;K[33287]=0;a=K[33282];if(a){Ha(a);K[33286]=0;K[33282]=0}}function Hf(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;if(qb(a,K[b+8>>2],0)){Sd(b,c,d)}}function gf(a){a=a|0;var b=0,c=0;b=K[a>>2];c=K[b>>2];K[a>>2]=b+4;return c|0}function Na(a,b,c){var d=0;d=sa-16|0;sa=d;K[d+12>>2]=c;Yc(a,b,c);sa=d+16|0}function bd(a,b,c){a:{if(K[c+76>>2]<0){a=cd(a,b,c);break a}a=cd(a,b,c)}}function Hb(a,b){return b?a<<24|(a&65280)<<8|(a>>>8&65280|a>>>24):a}function Qb(a){if(a-8212>>>0>=12){a=rd(93856,a)}else{a=1}return a}
      function Af(a){a=a|0;if(!a){return 0}return(Td(a,125228)|0)!=0|0}function Se(a){var b=0;if(a){b=K[a+688>>2];if(b){Ha(b)}Ha(a)}}function Re(a){if((a|0)<=127){a=mb(87712,a)}else{a=0}return a}function Tc(a){if(L[a|0]){a=1}else{a=$a(a,a+1|0,3)}return!a}function Df(a,b,c){a=a|0;b=b|0;c=c|0;K[K[a>>2]+(b<<2)>>2]=c}function Ae(a){a=_(a|0)|0;a=(a|0)!=27?a:0;if(a){K[56798]=a}}function Vf(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;va=0;return 0}function Jb(a,b,c){a=a|0;b=b|0;c=c|0;return wa[c|0](a,b)|0}function Jf(a,b){a=a|0;b=b|0;return K[K[a>>2]+(b<<2)>>2]}function mb(a,b){a=_c(a,b);return L[a|0]==(b&255)?a:0}function of(a,b){a=a|0;b=b|0;return I[K[a+4>>2]+b|0]}function xg(a,b){tg(a,b,2147483647);va=ua;return ta}function ug(a){if(a){return 31-T(a-1^a)|0}return 32}function Va(a,b,c){if(!(L[a|0]&32)){cd(b,c,a)}}function dg(a,b){a=a|0;b=b|0;K[a+1088>>2]=b}function Zf(a){a=a|0;return _(K[a+60>>2])|0}function La(a,b,c){I[(Zc(a,b,c)+c|0)-1|0]=0}function wf(a,b){a=a|0;b=b|0;K[a+12>>2]=b}function ng(a,b){a=a|0;b=b|0;K[a+16>>2]=b}function ic(a){return Ec(a,188776,189328)}function fg(a,b){a=a|0;b=b|0;K[a+20>>2]=b}function sg(a,b){a=a|0;b=b|0;I[a+13|0]=b}function qg(a,b){a=a|0;b=b|0;I[a+14|0]=b}function og(a,b){a=a|0;b=b|0;I[a+15|0]=b}function jf(a,b){a=a|0;b=b|0;I[a+12|0]=b}function Qd(a,b){a=a|0;b=b|0;K[a+8>>2]=b}function ig(a){a=a|0;return K[a+424>>2]}function Yc(a,b,c){return ie(a,b,c,0,0)}function xe(a){a=a|0;return K[a+12>>2]}function Qe(a){a=a|0;return K[a+16>>2]}function Kf(a,b){a=a|0;b=b|0;K[a>>2]=b}function Je(a){a=a|0;return K[a+20>>2]}function $f(a){a=a|0;return K[a+24>>2]}function rg(a){a=a|0;return L[a+14|0]}function pg(a){a=a|0;return L[a+15|0]}function lf(a){a=a|0;return L[a+12|0]}function df(a){a=a|0;return L[a+13|0]}function Uc(a){a=a|0;return K[a+8>>2]}function Be(a){a=a|0;return K[a+4>>2]}function ye(a){a=a|0;return K[a>>2]}function wg(a,b,c){return tg(a,b,c)}function zf(a){a=a|0;return 84147}function yf(a){a=a|0;return 84787}function xf(a){a=a|0;return 85058}function Lc(a){a=a|0;if(a){Ha(a)}}function Za(a,b){Ca(Ba(a)+a|0,b)}function gd(a){a=a|0;return a|0}function Uf(a){a=a|0;return 36}function Ld(a){a=a|0;return 0}function cg(){return 227192}function Xb(a){a=a|0;Ha(a)}function vf(){return 0}function uf(){return 1}function tf(){return 2}function sf(){return 3}function rf(){return 4}function qf(){return 5}function pf(){return 6}function nf(){return 7}function mf(){return 8}function we(a){a=a|0}
      // EMSCRIPTEN_END_FUNCS
      g=L;r(s);var wa=e([null,hf,Ld,gf,kf,Kd,ff,mg,lg,gd,bg,ag,_f,Zf,Jb,Sf,Rf,Qf,Of,Nf,gd,Xb,we,we,If,Bf,Ef,Hf,Xb,Cf,Ff,Gf,Xb,yf,Xb,xf,Xb,zf,ef,kg,jg,ig,hg,gg,eg,dg,gd,Xb,Ld,Vf]);function xa(){return H.byteLength/65536|0}return{"v":cf,"w":Lc,"x":ye,"y":Kf,"z":of,"A":Uc,"B":Qd,"C":lf,"D":jf,"E":df,"F":sg,"G":rg,"H":qg,"I":pg,"J":og,"K":Qe,"L":ng,"M":Je,"N":fg,"O":Lc,"P":ye,"Q":Be,"R":Uc,"S":xe,"T":Qe,"U":Je,"V":$f,"W":Lc,"X":Yf,"Y":Xf,"Z":Wf,"_":Uf,"$":Tf,"aa":Pf,"ba":Mf,"ca":Lf,"da":Jf,"ea":Df,"fa":Be,"ga":Uc,"ha":Qd,"ia":xe,"ja":wf,"ka":Lc,"la":vf,"ma":uf,"na":tf,"oa":sf,"pa":rf,"qa":qf,"ra":pf,"sa":nf,"ta":mf,"ua":wa,"va":cg,"wa":Ha,"xa":Qa,"ya":Af}}return ya(za)}
      // EMSCRIPTEN_END_ASM
    )(info);
  },
  instantiate: function (binary, info) {
    return {
      then: function (ok) {
        var module = new WebAssembly.Module(binary);
        ok({ instance: new WebAssembly.Instance(module, info) });
      },
    };
  },
  RuntimeError: Error,
};
wasmBinary = [];
if (typeof WebAssembly != "object") {
  abort("no native wasm support detected");
}
var wasmMemory;
var ABORT = false;
var EXITSTATUS;
function assert(condition, text) {
  if (!condition) {
    abort(text);
  }
}
var UTF8Decoder =
  typeof TextDecoder != "undefined" ? new TextDecoder("utf8") : undefined;
function UTF8ArrayToString(heapOrArray, idx, maxBytesToRead) {
  var endIdx = idx + maxBytesToRead;
  var endPtr = idx;
  while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr;
  if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
    return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
  }
  var str = "";
  while (idx < endPtr) {
    var u0 = heapOrArray[idx++];
    if (!(u0 & 128)) {
      str += String.fromCharCode(u0);
      continue;
    }
    var u1 = heapOrArray[idx++] & 63;
    if ((u0 & 224) == 192) {
      str += String.fromCharCode(((u0 & 31) << 6) | u1);
      continue;
    }
    var u2 = heapOrArray[idx++] & 63;
    if ((u0 & 240) == 224) {
      u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
    } else {
      u0 =
        ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heapOrArray[idx++] & 63);
    }
    if (u0 < 65536) {
      str += String.fromCharCode(u0);
    } else {
      var ch = u0 - 65536;
      str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
    }
  }
  return str;
}
function UTF8ToString(ptr, maxBytesToRead) {
  return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
}
function stringToUTF8Array(str, heap, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) return 0;
  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1;
  for (var i = 0; i < str.length; ++i) {
    var u = str.charCodeAt(i);
    if (u >= 55296 && u <= 57343) {
      var u1 = str.charCodeAt(++i);
      u = (65536 + ((u & 1023) << 10)) | (u1 & 1023);
    }
    if (u <= 127) {
      if (outIdx >= endIdx) break;
      heap[outIdx++] = u;
    } else if (u <= 2047) {
      if (outIdx + 1 >= endIdx) break;
      heap[outIdx++] = 192 | (u >> 6);
      heap[outIdx++] = 128 | (u & 63);
    } else if (u <= 65535) {
      if (outIdx + 2 >= endIdx) break;
      heap[outIdx++] = 224 | (u >> 12);
      heap[outIdx++] = 128 | ((u >> 6) & 63);
      heap[outIdx++] = 128 | (u & 63);
    } else {
      if (outIdx + 3 >= endIdx) break;
      heap[outIdx++] = 240 | (u >> 18);
      heap[outIdx++] = 128 | ((u >> 12) & 63);
      heap[outIdx++] = 128 | ((u >> 6) & 63);
      heap[outIdx++] = 128 | (u & 63);
    }
  }
  heap[outIdx] = 0;
  return outIdx - startIdx;
}
function stringToUTF8(str, outPtr, maxBytesToWrite) {
  return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
}
function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    var c = str.charCodeAt(i);
    if (c <= 127) {
      len++;
    } else if (c <= 2047) {
      len += 2;
    } else if (c >= 55296 && c <= 57343) {
      len += 4;
      ++i;
    } else {
      len += 3;
    }
  }
  return len;
}
var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
function updateMemoryViews() {
  var b = wasmMemory.buffer;
  Module["HEAP8"] = HEAP8 = new Int8Array(b);
  Module["HEAP16"] = HEAP16 = new Int16Array(b);
  Module["HEAP32"] = HEAP32 = new Int32Array(b);
  Module["HEAPU8"] = HEAPU8 = new Uint8Array(b);
  Module["HEAPU16"] = HEAPU16 = new Uint16Array(b);
  Module["HEAPU32"] = HEAPU32 = new Uint32Array(b);
  Module["HEAPF32"] = HEAPF32 = new Float32Array(b);
  Module["HEAPF64"] = HEAPF64 = new Float64Array(b);
}
var INITIAL_MEMORY = Module["INITIAL_MEMORY"] || 16777216;
if (Module["wasmMemory"]) {
  wasmMemory = Module["wasmMemory"];
} else {
  wasmMemory = new WebAssembly.Memory({
    initial: INITIAL_MEMORY / 65536,
    maximum: INITIAL_MEMORY / 65536,
  });
}
updateMemoryViews();
INITIAL_MEMORY = wasmMemory.buffer.byteLength;
var wasmTable;
var __ATPRERUN__ = [];
var __ATINIT__ = [];
var __ATPOSTRUN__ = [];
var runtimeInitialized = false;
function keepRuntimeAlive() {
  return noExitRuntime;
}
function preRun() {
  if (Module["preRun"]) {
    if (typeof Module["preRun"] == "function")
      Module["preRun"] = [Module["preRun"]];
    while (Module["preRun"].length) {
      addOnPreRun(Module["preRun"].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}
function initRuntime() {
  runtimeInitialized = true;
  if (!Module["noFSInit"] && !FS.init.initialized) FS.init();
  FS.ignorePermissions = false;
  TTY.init();
  callRuntimeCallbacks(__ATINIT__);
}
function postRun() {
  if (Module["postRun"]) {
    if (typeof Module["postRun"] == "function")
      Module["postRun"] = [Module["postRun"]];
    while (Module["postRun"].length) {
      addOnPostRun(Module["postRun"].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}
function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}
function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}
function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null;
function getUniqueRunDependency(id) {
  return id;
}
function addRunDependency(id) {
  runDependencies++;
  if (Module["monitorRunDependencies"]) {
    Module["monitorRunDependencies"](runDependencies);
  }
}
function removeRunDependency(id) {
  runDependencies--;
  if (Module["monitorRunDependencies"]) {
    Module["monitorRunDependencies"](runDependencies);
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback();
    }
  }
}
function abort(what) {
  if (Module["onAbort"]) {
    Module["onAbort"](what);
  }
  what = "Aborted(" + what + ")";
  err(what);
  ABORT = true;
  EXITSTATUS = 1;
  what += ". Build with -sASSERTIONS for more info.";
  var e = new WebAssembly.RuntimeError(what);
  throw e;
}
var dataURIPrefix = "data:application/octet-stream;base64,";
function isDataURI(filename) {
  return filename.startsWith(dataURIPrefix);
}
function isFileURI(filename) {
  return filename.startsWith("file://");
}
var wasmBinaryFile;
// wasmBinaryFile = "espeakng.worker.wasm";
// if (!isDataURI(wasmBinaryFile)) {
//   wasmBinaryFile = locateFile(wasmBinaryFile);
// }
function getBinary(file) {
  try {
    if (file == wasmBinaryFile && wasmBinary) {
      return new Uint8Array(wasmBinary);
    }
    var binary = tryParseAsDataURI(file);
    if (binary) {
      return binary;
    }
    if (readBinary) {
      return readBinary(file);
    }
    throw "both async and sync fetching of the wasm failed";
  } catch (err) {
    abort(err);
  }
}
function getBinaryPromise() {
  if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
    if (typeof fetch == "function" && !isFileURI(wasmBinaryFile)) {
      return fetch(wasmBinaryFile, { credentials: "same-origin" })
        .then(function (response) {
          if (!response["ok"]) {
            throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
          }
          return response["arrayBuffer"]();
        })
        .catch(function () {
          return getBinary(wasmBinaryFile);
        });
    } else {
      if (readAsync) {
        return new Promise(function (resolve, reject) {
          readAsync(
            wasmBinaryFile,
            function (response) {
              resolve(new Uint8Array(response));
            },
            reject,
          );
        });
      }
    }
  }
  return Promise.resolve().then(function () {
    return getBinary(wasmBinaryFile);
  });
}
function createWasm() {
  var info = { a: asmLibraryArg };
  function receiveInstance(instance, module) {
    var exports = instance.exports;
    Module["asm"] = exports;
    wasmTable = Module["asm"]["ua"];
    addOnInit(Module["asm"]["v"]);
    removeRunDependency("wasm-instantiate");
  }
  addRunDependency("wasm-instantiate");
  function receiveInstantiationResult(result) {
    receiveInstance(result["instance"]);
  }
  function instantiateArrayBuffer(receiver) {
    return getBinaryPromise()
      .then(function (binary) {
        return WebAssembly.instantiate(binary, info);
      })
      .then(function (instance) {
        return instance;
      })
      .then(receiver, function (reason) {
        err("failed to asynchronously prepare wasm: " + reason);
        abort(reason);
      });
  }
  function instantiateAsync() {
    if (
      !wasmBinary &&
      typeof WebAssembly.instantiateStreaming == "function" &&
      !isDataURI(wasmBinaryFile) &&
      !isFileURI(wasmBinaryFile) &&
      !ENVIRONMENT_IS_NODE &&
      typeof fetch == "function"
    ) {
      return fetch(wasmBinaryFile, { credentials: "same-origin" }).then(
        function (response) {
          var result = WebAssembly.instantiateStreaming(response, info);
          return result.then(receiveInstantiationResult, function (reason) {
            err("wasm streaming compile failed: " + reason);
            err("falling back to ArrayBuffer instantiation");
            return instantiateArrayBuffer(receiveInstantiationResult);
          });
        },
      );
    } else {
      return instantiateArrayBuffer(receiveInstantiationResult);
    }
  }
  if (Module["instantiateWasm"]) {
    try {
      var exports = Module["instantiateWasm"](info, receiveInstance);
      return exports;
    } catch (e) {
      err("Module.instantiateWasm callback failed with error: " + e);
      return false;
    }
  }
  instantiateAsync();
  return {};
}
var tempDouble;
var tempI64;
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
}
function callRuntimeCallbacks(callbacks) {
  while (callbacks.length > 0) {
    callbacks.shift()(Module);
  }
}
function getValue(ptr, type = "i8") {
  if (type.endsWith("*")) type = "*";
  switch (type) {
    case "i1":
      return HEAP8[ptr >> 0];
    case "i8":
      return HEAP8[ptr >> 0];
    case "i16":
      return HEAP16[ptr >> 1];
    case "i32":
      return HEAP32[ptr >> 2];
    case "i64":
      return HEAP32[ptr >> 2];
    case "float":
      return HEAPF32[ptr >> 2];
    case "double":
      return HEAPF64[ptr >> 3];
    case "*":
      return HEAPU32[ptr >> 2];
    default:
      abort("invalid type for getValue: " + type);
  }
  return null;
}
function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 255) {
      if (ASSERTIONS) {
        assert(
          false,
          "Character code " +
            chr +
            " (" +
            String.fromCharCode(chr) +
            ")  at offset " +
            i +
            " not in 0x00-0xFF.",
        );
      }
      chr &= 255;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join("");
}
function ___assert_fail(condition, filename, line, func) {
  abort(
    "Assertion failed: " +
      UTF8ToString(condition) +
      ", at: " +
      [
        filename ? UTF8ToString(filename) : "unknown filename",
        line,
        func ? UTF8ToString(func) : "unknown function",
      ],
  );
}
function ExceptionInfo(excPtr) {
  this.excPtr = excPtr;
  this.ptr = excPtr - 24;
  this.set_type = function (type) {
    HEAPU32[(this.ptr + 4) >> 2] = type;
  };
  this.get_type = function () {
    return HEAPU32[(this.ptr + 4) >> 2];
  };
  this.set_destructor = function (destructor) {
    HEAPU32[(this.ptr + 8) >> 2] = destructor;
  };
  this.get_destructor = function () {
    return HEAPU32[(this.ptr + 8) >> 2];
  };
  this.set_refcount = function (refcount) {
    HEAP32[this.ptr >> 2] = refcount;
  };
  this.set_caught = function (caught) {
    caught = caught ? 1 : 0;
    HEAP8[(this.ptr + 12) >> 0] = caught;
  };
  this.get_caught = function () {
    return HEAP8[(this.ptr + 12) >> 0] != 0;
  };
  this.set_rethrown = function (rethrown) {
    rethrown = rethrown ? 1 : 0;
    HEAP8[(this.ptr + 13) >> 0] = rethrown;
  };
  this.get_rethrown = function () {
    return HEAP8[(this.ptr + 13) >> 0] != 0;
  };
  this.init = function (type, destructor) {
    this.set_adjusted_ptr(0);
    this.set_type(type);
    this.set_destructor(destructor);
    this.set_refcount(0);
    this.set_caught(false);
    this.set_rethrown(false);
  };
  this.add_ref = function () {
    var value = HEAP32[this.ptr >> 2];
    HEAP32[this.ptr >> 2] = value + 1;
  };
  this.release_ref = function () {
    var prev = HEAP32[this.ptr >> 2];
    HEAP32[this.ptr >> 2] = prev - 1;
    return prev === 1;
  };
  this.set_adjusted_ptr = function (adjustedPtr) {
    HEAPU32[(this.ptr + 16) >> 2] = adjustedPtr;
  };
  this.get_adjusted_ptr = function () {
    return HEAPU32[(this.ptr + 16) >> 2];
  };
  this.get_exception_ptr = function () {
    var isPointer = ___cxa_is_pointer_type(this.get_type());
    if (isPointer) {
      return HEAPU32[this.excPtr >> 2];
    }
    var adjusted = this.get_adjusted_ptr();
    if (adjusted !== 0) return adjusted;
    return this.excPtr;
  };
}
var exceptionLast = 0;
var uncaughtExceptionCount = 0;
function ___cxa_throw(ptr, type, destructor) {
  var info = new ExceptionInfo(ptr);
  info.init(type, destructor);
  exceptionLast = ptr;
  uncaughtExceptionCount++;
  throw ptr;
}
function setErrNo(value) {
  HEAP32[___errno_location() >> 2] = value;
  return value;
}
var PATH = {
  isAbs: (path) => path.charAt(0) === "/",
  splitPath: (filename) => {
    var splitPathRe =
      /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
    return splitPathRe.exec(filename).slice(1);
  },
  normalizeArray: (parts, allowAboveRoot) => {
    var up = 0;
    for (var i = parts.length - 1; i >= 0; i--) {
      var last = parts[i];
      if (last === ".") {
        parts.splice(i, 1);
      } else if (last === "..") {
        parts.splice(i, 1);
        up++;
      } else if (up) {
        parts.splice(i, 1);
        up--;
      }
    }
    if (allowAboveRoot) {
      for (; up; up--) {
        parts.unshift("..");
      }
    }
    return parts;
  },
  normalize: (path) => {
    var isAbsolute = PATH.isAbs(path),
      trailingSlash = path.substr(-1) === "/";
    path = PATH.normalizeArray(
      path.split("/").filter((p) => !!p),
      !isAbsolute,
    ).join("/");
    if (!path && !isAbsolute) {
      path = ".";
    }
    if (path && trailingSlash) {
      path += "/";
    }
    return (isAbsolute ? "/" : "") + path;
  },
  dirname: (path) => {
    var result = PATH.splitPath(path),
      root = result[0],
      dir = result[1];
    if (!root && !dir) {
      return ".";
    }
    if (dir) {
      dir = dir.substr(0, dir.length - 1);
    }
    return root + dir;
  },
  basename: (path) => {
    if (path === "/") return "/";
    path = PATH.normalize(path);
    path = path.replace(/\/$/, "");
    var lastSlash = path.lastIndexOf("/");
    if (lastSlash === -1) return path;
    return path.substr(lastSlash + 1);
  },
  join: function () {
    var paths = Array.prototype.slice.call(arguments);
    return PATH.normalize(paths.join("/"));
  },
  join2: (l, r) => {
    return PATH.normalize(l + "/" + r);
  },
};
function getRandomDevice() {
  if (
    typeof crypto == "object" &&
    typeof crypto["getRandomValues"] == "function"
  ) {
    var randomBuffer = new Uint8Array(1);
    return () => {
      crypto.getRandomValues(randomBuffer);
      return randomBuffer[0];
    };
  } else if (ENVIRONMENT_IS_NODE) {
    try {
      var crypto_module = require("crypto");
      return () => crypto_module["randomBytes"](1)[0];
    } catch (e) {}
  }
  return () => abort("randomDevice");
}
var PATH_FS = {
  resolve: function () {
    var resolvedPath = "",
      resolvedAbsolute = false;
    for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      var path = i >= 0 ? arguments[i] : FS.cwd();
      if (typeof path != "string") {
        throw new TypeError("Arguments to path.resolve must be strings");
      } else if (!path) {
        return "";
      }
      resolvedPath = path + "/" + resolvedPath;
      resolvedAbsolute = PATH.isAbs(path);
    }
    resolvedPath = PATH.normalizeArray(
      resolvedPath.split("/").filter((p) => !!p),
      !resolvedAbsolute,
    ).join("/");
    return (resolvedAbsolute ? "/" : "") + resolvedPath || ".";
  },
  relative: (from, to) => {
    from = PATH_FS.resolve(from).substr(1);
    to = PATH_FS.resolve(to).substr(1);
    function trim(arr) {
      var start = 0;
      for (; start < arr.length; start++) {
        if (arr[start] !== "") break;
      }
      var end = arr.length - 1;
      for (; end >= 0; end--) {
        if (arr[end] !== "") break;
      }
      if (start > end) return [];
      return arr.slice(start, end - start + 1);
    }
    var fromParts = trim(from.split("/"));
    var toParts = trim(to.split("/"));
    var length = Math.min(fromParts.length, toParts.length);
    var samePartsLength = length;
    for (var i = 0; i < length; i++) {
      if (fromParts[i] !== toParts[i]) {
        samePartsLength = i;
        break;
      }
    }
    var outputParts = [];
    for (var i = samePartsLength; i < fromParts.length; i++) {
      outputParts.push("..");
    }
    outputParts = outputParts.concat(toParts.slice(samePartsLength));
    return outputParts.join("/");
  },
};
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}
var TTY = {
  ttys: [],
  init: function () {},
  shutdown: function () {},
  register: function (dev, ops) {
    TTY.ttys[dev] = { input: [], output: [], ops: ops };
    FS.registerDevice(dev, TTY.stream_ops);
  },
  stream_ops: {
    open: function (stream) {
      var tty = TTY.ttys[stream.node.rdev];
      if (!tty) {
        throw new FS.ErrnoError(43);
      }
      stream.tty = tty;
      stream.seekable = false;
    },
    close: function (stream) {
      stream.tty.ops.fsync(stream.tty);
    },
    fsync: function (stream) {
      stream.tty.ops.fsync(stream.tty);
    },
    read: function (stream, buffer, offset, length, pos) {
      if (!stream.tty || !stream.tty.ops.get_char) {
        throw new FS.ErrnoError(60);
      }
      var bytesRead = 0;
      for (var i = 0; i < length; i++) {
        var result;
        try {
          result = stream.tty.ops.get_char(stream.tty);
        } catch (e) {
          throw new FS.ErrnoError(29);
        }
        if (result === undefined && bytesRead === 0) {
          throw new FS.ErrnoError(6);
        }
        if (result === null || result === undefined) break;
        bytesRead++;
        buffer[offset + i] = result;
      }
      if (bytesRead) {
        stream.node.timestamp = Date.now();
      }
      return bytesRead;
    },
    write: function (stream, buffer, offset, length, pos) {
      if (!stream.tty || !stream.tty.ops.put_char) {
        throw new FS.ErrnoError(60);
      }
      try {
        for (var i = 0; i < length; i++) {
          stream.tty.ops.put_char(stream.tty, buffer[offset + i]);
        }
      } catch (e) {
        throw new FS.ErrnoError(29);
      }
      if (length) {
        stream.node.timestamp = Date.now();
      }
      return i;
    },
  },
  default_tty_ops: {
    get_char: function (tty) {
      if (!tty.input.length) {
        var result = null;
        if (ENVIRONMENT_IS_NODE) {
          var BUFSIZE = 256;
          var buf = Buffer.alloc(BUFSIZE);
          var bytesRead = 0;
          try {
            bytesRead = fs.readSync(process.stdin.fd, buf, 0, BUFSIZE, -1);
          } catch (e) {
            if (e.toString().includes("EOF")) bytesRead = 0;
            else throw e;
          }
          if (bytesRead > 0) {
            result = buf.slice(0, bytesRead).toString("utf-8");
          } else {
            result = null;
          }
        } else if (
          typeof window != "undefined" &&
          typeof window.prompt == "function"
        ) {
          result = window.prompt("Input: ");
          if (result !== null) {
            result += "\n";
          }
        } else if (typeof readline == "function") {
          result = readline();
          if (result !== null) {
            result += "\n";
          }
        }
        if (!result) {
          return null;
        }
        tty.input = intArrayFromString(result, true);
      }
      return tty.input.shift();
    },
    put_char: function (tty, val) {
      if (val === null || val === 10) {
        out(UTF8ArrayToString(tty.output, 0));
        tty.output = [];
      } else {
        if (val != 0) tty.output.push(val);
      }
    },
    fsync: function (tty) {
      if (tty.output && tty.output.length > 0) {
        out(UTF8ArrayToString(tty.output, 0));
        tty.output = [];
      }
    },
  },
  default_tty1_ops: {
    put_char: function (tty, val) {
      if (val === null || val === 10) {
        err(UTF8ArrayToString(tty.output, 0));
        tty.output = [];
      } else {
        if (val != 0) tty.output.push(val);
      }
    },
    fsync: function (tty) {
      if (tty.output && tty.output.length > 0) {
        err(UTF8ArrayToString(tty.output, 0));
        tty.output = [];
      }
    },
  },
};
function mmapAlloc(size) {
  abort();
}
var MEMFS = {
  ops_table: null,
  mount: function (mount) {
    return MEMFS.createNode(null, "/", 16384 | 511, 0);
  },
  createNode: function (parent, name, mode, dev) {
    if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
      throw new FS.ErrnoError(63);
    }
    if (!MEMFS.ops_table) {
      MEMFS.ops_table = {
        dir: {
          node: {
            getattr: MEMFS.node_ops.getattr,
            setattr: MEMFS.node_ops.setattr,
            lookup: MEMFS.node_ops.lookup,
            mknod: MEMFS.node_ops.mknod,
            rename: MEMFS.node_ops.rename,
            unlink: MEMFS.node_ops.unlink,
            rmdir: MEMFS.node_ops.rmdir,
            readdir: MEMFS.node_ops.readdir,
            symlink: MEMFS.node_ops.symlink,
          },
          stream: { llseek: MEMFS.stream_ops.llseek },
        },
        file: {
          node: {
            getattr: MEMFS.node_ops.getattr,
            setattr: MEMFS.node_ops.setattr,
          },
          stream: {
            llseek: MEMFS.stream_ops.llseek,
            read: MEMFS.stream_ops.read,
            write: MEMFS.stream_ops.write,
            allocate: MEMFS.stream_ops.allocate,
            mmap: MEMFS.stream_ops.mmap,
            msync: MEMFS.stream_ops.msync,
          },
        },
        link: {
          node: {
            getattr: MEMFS.node_ops.getattr,
            setattr: MEMFS.node_ops.setattr,
            readlink: MEMFS.node_ops.readlink,
          },
          stream: {},
        },
        chrdev: {
          node: {
            getattr: MEMFS.node_ops.getattr,
            setattr: MEMFS.node_ops.setattr,
          },
          stream: FS.chrdev_stream_ops,
        },
      };
    }
    var node = FS.createNode(parent, name, mode, dev);
    if (FS.isDir(node.mode)) {
      node.node_ops = MEMFS.ops_table.dir.node;
      node.stream_ops = MEMFS.ops_table.dir.stream;
      node.contents = {};
    } else if (FS.isFile(node.mode)) {
      node.node_ops = MEMFS.ops_table.file.node;
      node.stream_ops = MEMFS.ops_table.file.stream;
      node.usedBytes = 0;
      node.contents = null;
    } else if (FS.isLink(node.mode)) {
      node.node_ops = MEMFS.ops_table.link.node;
      node.stream_ops = MEMFS.ops_table.link.stream;
    } else if (FS.isChrdev(node.mode)) {
      node.node_ops = MEMFS.ops_table.chrdev.node;
      node.stream_ops = MEMFS.ops_table.chrdev.stream;
    }
    node.timestamp = Date.now();
    if (parent) {
      parent.contents[name] = node;
      parent.timestamp = node.timestamp;
    }
    return node;
  },
  getFileDataAsTypedArray: function (node) {
    if (!node.contents) return new Uint8Array(0);
    if (node.contents.subarray)
      return node.contents.subarray(0, node.usedBytes);
    return new Uint8Array(node.contents);
  },
  expandFileStorage: function (node, newCapacity) {
    var prevCapacity = node.contents ? node.contents.length : 0;
    if (prevCapacity >= newCapacity) return;
    var CAPACITY_DOUBLING_MAX = 1024 * 1024;
    newCapacity = Math.max(
      newCapacity,
      (prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125)) >>> 0,
    );
    if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256);
    var oldContents = node.contents;
    node.contents = new Uint8Array(newCapacity);
    if (node.usedBytes > 0)
      node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
  },
  resizeFileStorage: function (node, newSize) {
    if (node.usedBytes == newSize) return;
    if (newSize == 0) {
      node.contents = null;
      node.usedBytes = 0;
    } else {
      var oldContents = node.contents;
      node.contents = new Uint8Array(newSize);
      if (oldContents) {
        node.contents.set(
          oldContents.subarray(0, Math.min(newSize, node.usedBytes)),
        );
      }
      node.usedBytes = newSize;
    }
  },
  node_ops: {
    getattr: function (node) {
      var attr = {};
      attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
      attr.ino = node.id;
      attr.mode = node.mode;
      attr.nlink = 1;
      attr.uid = 0;
      attr.gid = 0;
      attr.rdev = node.rdev;
      if (FS.isDir(node.mode)) {
        attr.size = 4096;
      } else if (FS.isFile(node.mode)) {
        attr.size = node.usedBytes;
      } else if (FS.isLink(node.mode)) {
        attr.size = node.link.length;
      } else {
        attr.size = 0;
      }
      attr.atime = new Date(node.timestamp);
      attr.mtime = new Date(node.timestamp);
      attr.ctime = new Date(node.timestamp);
      attr.blksize = 4096;
      attr.blocks = Math.ceil(attr.size / attr.blksize);
      return attr;
    },
    setattr: function (node, attr) {
      if (attr.mode !== undefined) {
        node.mode = attr.mode;
      }
      if (attr.timestamp !== undefined) {
        node.timestamp = attr.timestamp;
      }
      if (attr.size !== undefined) {
        MEMFS.resizeFileStorage(node, attr.size);
      }
    },
    lookup: function (parent, name) {
      throw FS.genericErrors[44];
    },
    mknod: function (parent, name, mode, dev) {
      return MEMFS.createNode(parent, name, mode, dev);
    },
    rename: function (old_node, new_dir, new_name) {
      if (FS.isDir(old_node.mode)) {
        var new_node;
        try {
          new_node = FS.lookupNode(new_dir, new_name);
        } catch (e) {}
        if (new_node) {
          for (var i in new_node.contents) {
            throw new FS.ErrnoError(55);
          }
        }
      }
      delete old_node.parent.contents[old_node.name];
      old_node.parent.timestamp = Date.now();
      old_node.name = new_name;
      new_dir.contents[new_name] = old_node;
      new_dir.timestamp = old_node.parent.timestamp;
      old_node.parent = new_dir;
    },
    unlink: function (parent, name) {
      delete parent.contents[name];
      parent.timestamp = Date.now();
    },
    rmdir: function (parent, name) {
      var node = FS.lookupNode(parent, name);
      for (var i in node.contents) {
        throw new FS.ErrnoError(55);
      }
      delete parent.contents[name];
      parent.timestamp = Date.now();
    },
    readdir: function (node) {
      var entries = [".", ".."];
      for (var key in node.contents) {
        if (!node.contents.hasOwnProperty(key)) {
          continue;
        }
        entries.push(key);
      }
      return entries;
    },
    symlink: function (parent, newname, oldpath) {
      var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
      node.link = oldpath;
      return node;
    },
    readlink: function (node) {
      if (!FS.isLink(node.mode)) {
        throw new FS.ErrnoError(28);
      }
      return node.link;
    },
  },
  stream_ops: {
    read: function (stream, buffer, offset, length, position) {
      var contents = stream.node.contents;
      if (position >= stream.node.usedBytes) return 0;
      var size = Math.min(stream.node.usedBytes - position, length);
      if (size > 8 && contents.subarray) {
        buffer.set(contents.subarray(position, position + size), offset);
      } else {
        for (var i = 0; i < size; i++)
          buffer[offset + i] = contents[position + i];
      }
      return size;
    },
    write: function (stream, buffer, offset, length, position, canOwn) {
      if (!length) return 0;
      var node = stream.node;
      node.timestamp = Date.now();
      if (buffer.subarray && (!node.contents || node.contents.subarray)) {
        if (canOwn) {
          node.contents = buffer.subarray(offset, offset + length);
          node.usedBytes = length;
          return length;
        } else if (node.usedBytes === 0 && position === 0) {
          node.contents = buffer.slice(offset, offset + length);
          node.usedBytes = length;
          return length;
        } else if (position + length <= node.usedBytes) {
          node.contents.set(buffer.subarray(offset, offset + length), position);
          return length;
        }
      }
      MEMFS.expandFileStorage(node, position + length);
      if (node.contents.subarray && buffer.subarray) {
        node.contents.set(buffer.subarray(offset, offset + length), position);
      } else {
        for (var i = 0; i < length; i++) {
          node.contents[position + i] = buffer[offset + i];
        }
      }
      node.usedBytes = Math.max(node.usedBytes, position + length);
      return length;
    },
    llseek: function (stream, offset, whence) {
      var position = offset;
      if (whence === 1) {
        position += stream.position;
      } else if (whence === 2) {
        if (FS.isFile(stream.node.mode)) {
          position += stream.node.usedBytes;
        }
      }
      if (position < 0) {
        throw new FS.ErrnoError(28);
      }
      return position;
    },
    allocate: function (stream, offset, length) {
      MEMFS.expandFileStorage(stream.node, offset + length);
      stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
    },
    mmap: function (stream, length, position, prot, flags) {
      if (!FS.isFile(stream.node.mode)) {
        throw new FS.ErrnoError(43);
      }
      var ptr;
      var allocated;
      var contents = stream.node.contents;
      if (!(flags & 2) && contents.buffer === HEAP8.buffer) {
        allocated = false;
        ptr = contents.byteOffset;
      } else {
        if (position > 0 || position + length < contents.length) {
          if (contents.subarray) {
            contents = contents.subarray(position, position + length);
          } else {
            contents = Array.prototype.slice.call(
              contents,
              position,
              position + length,
            );
          }
        }
        allocated = true;
        ptr = mmapAlloc(length);
        if (!ptr) {
          throw new FS.ErrnoError(48);
        }
        HEAP8.set(contents, ptr);
      }
      return { ptr: ptr, allocated: allocated };
    },
    msync: function (stream, buffer, offset, length, mmapFlags) {
      MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
      return 0;
    },
  },
};
function asyncLoad(url, onload, onerror, noRunDep) {
  var dep = !noRunDep ? getUniqueRunDependency("al " + url) : "";
  readAsync(
    url,
    (arrayBuffer) => {
      assert(
        arrayBuffer,
        'Loading data file "' + url + '" failed (no arrayBuffer).',
      );
      onload(new Uint8Array(arrayBuffer));
      if (dep) removeRunDependency(dep);
    },
    (event) => {
      if (onerror) {
        onerror();
      } else {
        throw 'Loading data file "' + url + '" failed.';
      }
    },
  );
  if (dep) addRunDependency(dep);
}
var FS = {
  root: null,
  mounts: [],
  devices: {},
  streams: [],
  nextInode: 1,
  nameTable: null,
  currentPath: "/",
  initialized: false,
  ignorePermissions: true,
  ErrnoError: null,
  genericErrors: {},
  filesystems: null,
  syncFSRequests: 0,
  lookupPath: (path, opts = {}) => {
    path = PATH_FS.resolve(path);
    if (!path) return { path: "", node: null };
    var defaults = { follow_mount: true, recurse_count: 0 };
    opts = Object.assign(defaults, opts);
    if (opts.recurse_count > 8) {
      throw new FS.ErrnoError(32);
    }
    var parts = path.split("/").filter((p) => !!p);
    var current = FS.root;
    var current_path = "/";
    for (var i = 0; i < parts.length; i++) {
      var islast = i === parts.length - 1;
      if (islast && opts.parent) {
        break;
      }
      current = FS.lookupNode(current, parts[i]);
      current_path = PATH.join2(current_path, parts[i]);
      if (FS.isMountpoint(current)) {
        if (!islast || (islast && opts.follow_mount)) {
          current = current.mounted.root;
        }
      }
      if (!islast || opts.follow) {
        var count = 0;
        while (FS.isLink(current.mode)) {
          var link = FS.readlink(current_path);
          current_path = PATH_FS.resolve(PATH.dirname(current_path), link);
          var lookup = FS.lookupPath(current_path, {
            recurse_count: opts.recurse_count + 1,
          });
          current = lookup.node;
          if (count++ > 40) {
            throw new FS.ErrnoError(32);
          }
        }
      }
    }
    return { path: current_path, node: current };
  },
  getPath: (node) => {
    var path;
    while (true) {
      if (FS.isRoot(node)) {
        var mount = node.mount.mountpoint;
        if (!path) return mount;
        return mount[mount.length - 1] !== "/"
          ? mount + "/" + path
          : mount + path;
      }
      path = path ? node.name + "/" + path : node.name;
      node = node.parent;
    }
  },
  hashName: (parentid, name) => {
    var hash = 0;
    for (var i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
    }
    return ((parentid + hash) >>> 0) % FS.nameTable.length;
  },
  hashAddNode: (node) => {
    var hash = FS.hashName(node.parent.id, node.name);
    node.name_next = FS.nameTable[hash];
    FS.nameTable[hash] = node;
  },
  hashRemoveNode: (node) => {
    var hash = FS.hashName(node.parent.id, node.name);
    if (FS.nameTable[hash] === node) {
      FS.nameTable[hash] = node.name_next;
    } else {
      var current = FS.nameTable[hash];
      while (current) {
        if (current.name_next === node) {
          current.name_next = node.name_next;
          break;
        }
        current = current.name_next;
      }
    }
  },
  lookupNode: (parent, name) => {
    var errCode = FS.mayLookup(parent);
    if (errCode) {
      throw new FS.ErrnoError(errCode, parent);
    }
    var hash = FS.hashName(parent.id, name);
    for (var node = FS.nameTable[hash]; node; node = node.name_next) {
      var nodeName = node.name;
      if (node.parent.id === parent.id && nodeName === name) {
        return node;
      }
    }
    return FS.lookup(parent, name);
  },
  createNode: (parent, name, mode, rdev) => {
    var node = new FS.FSNode(parent, name, mode, rdev);
    FS.hashAddNode(node);
    return node;
  },
  destroyNode: (node) => {
    FS.hashRemoveNode(node);
  },
  isRoot: (node) => {
    return node === node.parent;
  },
  isMountpoint: (node) => {
    return !!node.mounted;
  },
  isFile: (mode) => {
    return (mode & 61440) === 32768;
  },
  isDir: (mode) => {
    return (mode & 61440) === 16384;
  },
  isLink: (mode) => {
    return (mode & 61440) === 40960;
  },
  isChrdev: (mode) => {
    return (mode & 61440) === 8192;
  },
  isBlkdev: (mode) => {
    return (mode & 61440) === 24576;
  },
  isFIFO: (mode) => {
    return (mode & 61440) === 4096;
  },
  isSocket: (mode) => {
    return (mode & 49152) === 49152;
  },
  flagModes: { r: 0, "r+": 2, w: 577, "w+": 578, a: 1089, "a+": 1090 },
  modeStringToFlags: (str) => {
    var flags = FS.flagModes[str];
    if (typeof flags == "undefined") {
      throw new Error("Unknown file open mode: " + str);
    }
    return flags;
  },
  flagsToPermissionString: (flag) => {
    var perms = ["r", "w", "rw"][flag & 3];
    if (flag & 512) {
      perms += "w";
    }
    return perms;
  },
  nodePermissions: (node, perms) => {
    if (FS.ignorePermissions) {
      return 0;
    }
    if (perms.includes("r") && !(node.mode & 292)) {
      return 2;
    } else if (perms.includes("w") && !(node.mode & 146)) {
      return 2;
    } else if (perms.includes("x") && !(node.mode & 73)) {
      return 2;
    }
    return 0;
  },
  mayLookup: (dir) => {
    var errCode = FS.nodePermissions(dir, "x");
    if (errCode) return errCode;
    if (!dir.node_ops.lookup) return 2;
    return 0;
  },
  mayCreate: (dir, name) => {
    try {
      var node = FS.lookupNode(dir, name);
      return 20;
    } catch (e) {}
    return FS.nodePermissions(dir, "wx");
  },
  mayDelete: (dir, name, isdir) => {
    var node;
    try {
      node = FS.lookupNode(dir, name);
    } catch (e) {
      return e.errno;
    }
    var errCode = FS.nodePermissions(dir, "wx");
    if (errCode) {
      return errCode;
    }
    if (isdir) {
      if (!FS.isDir(node.mode)) {
        return 54;
      }
      if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
        return 10;
      }
    } else {
      if (FS.isDir(node.mode)) {
        return 31;
      }
    }
    return 0;
  },
  mayOpen: (node, flags) => {
    if (!node) {
      return 44;
    }
    if (FS.isLink(node.mode)) {
      return 32;
    } else if (FS.isDir(node.mode)) {
      if (FS.flagsToPermissionString(flags) !== "r" || flags & 512) {
        return 31;
      }
    }
    return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
  },
  MAX_OPEN_FDS: 4096,
  nextfd: (fd_start = 0, fd_end = FS.MAX_OPEN_FDS) => {
    for (var fd = fd_start; fd <= fd_end; fd++) {
      if (!FS.streams[fd]) {
        return fd;
      }
    }
    throw new FS.ErrnoError(33);
  },
  getStream: (fd) => FS.streams[fd],
  createStream: (stream, fd_start, fd_end) => {
    if (!FS.FSStream) {
      FS.FSStream = function () {
        this.shared = {};
      };
      FS.FSStream.prototype = {};
      Object.defineProperties(FS.FSStream.prototype, {
        object: {
          get: function () {
            return this.node;
          },
          set: function (val) {
            this.node = val;
          },
        },
        isRead: {
          get: function () {
            return (this.flags & 2097155) !== 1;
          },
        },
        isWrite: {
          get: function () {
            return (this.flags & 2097155) !== 0;
          },
        },
        isAppend: {
          get: function () {
            return this.flags & 1024;
          },
        },
        flags: {
          get: function () {
            return this.shared.flags;
          },
          set: function (val) {
            this.shared.flags = val;
          },
        },
        position: {
          get: function () {
            return this.shared.position;
          },
          set: function (val) {
            this.shared.position = val;
          },
        },
      });
    }
    stream = Object.assign(new FS.FSStream(), stream);
    var fd = FS.nextfd(fd_start, fd_end);
    stream.fd = fd;
    FS.streams[fd] = stream;
    return stream;
  },
  closeStream: (fd) => {
    FS.streams[fd] = null;
  },
  chrdev_stream_ops: {
    open: (stream) => {
      var device = FS.getDevice(stream.node.rdev);
      stream.stream_ops = device.stream_ops;
      if (stream.stream_ops.open) {
        stream.stream_ops.open(stream);
      }
    },
    llseek: () => {
      throw new FS.ErrnoError(70);
    },
  },
  major: (dev) => dev >> 8,
  minor: (dev) => dev & 255,
  makedev: (ma, mi) => (ma << 8) | mi,
  registerDevice: (dev, ops) => {
    FS.devices[dev] = { stream_ops: ops };
  },
  getDevice: (dev) => FS.devices[dev],
  getMounts: (mount) => {
    var mounts = [];
    var check = [mount];
    while (check.length) {
      var m = check.pop();
      mounts.push(m);
      check.push.apply(check, m.mounts);
    }
    return mounts;
  },
  syncfs: (populate, callback) => {
    if (typeof populate == "function") {
      callback = populate;
      populate = false;
    }
    FS.syncFSRequests++;
    if (FS.syncFSRequests > 1) {
      err(
        "warning: " +
          FS.syncFSRequests +
          " FS.syncfs operations in flight at once, probably just doing extra work",
      );
    }
    var mounts = FS.getMounts(FS.root.mount);
    var completed = 0;
    function doCallback(errCode) {
      FS.syncFSRequests--;
      return callback(errCode);
    }
    function done(errCode) {
      if (errCode) {
        if (!done.errored) {
          done.errored = true;
          return doCallback(errCode);
        }
        return;
      }
      if (++completed >= mounts.length) {
        doCallback(null);
      }
    }
    mounts.forEach((mount) => {
      if (!mount.type.syncfs) {
        return done(null);
      }
      mount.type.syncfs(mount, populate, done);
    });
  },
  mount: (type, opts, mountpoint) => {
    var root = mountpoint === "/";
    var pseudo = !mountpoint;
    var node;
    if (root && FS.root) {
      throw new FS.ErrnoError(10);
    } else if (!root && !pseudo) {
      var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
      mountpoint = lookup.path;
      node = lookup.node;
      if (FS.isMountpoint(node)) {
        throw new FS.ErrnoError(10);
      }
      if (!FS.isDir(node.mode)) {
        throw new FS.ErrnoError(54);
      }
    }
    var mount = { type: type, opts: opts, mountpoint: mountpoint, mounts: [] };
    var mountRoot = type.mount(mount);
    mountRoot.mount = mount;
    mount.root = mountRoot;
    if (root) {
      FS.root = mountRoot;
    } else if (node) {
      node.mounted = mount;
      if (node.mount) {
        node.mount.mounts.push(mount);
      }
    }
    return mountRoot;
  },
  unmount: (mountpoint) => {
    var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
    if (!FS.isMountpoint(lookup.node)) {
      throw new FS.ErrnoError(28);
    }
    var node = lookup.node;
    var mount = node.mounted;
    var mounts = FS.getMounts(mount);
    Object.keys(FS.nameTable).forEach((hash) => {
      var current = FS.nameTable[hash];
      while (current) {
        var next = current.name_next;
        if (mounts.includes(current.mount)) {
          FS.destroyNode(current);
        }
        current = next;
      }
    });
    node.mounted = null;
    var idx = node.mount.mounts.indexOf(mount);
    node.mount.mounts.splice(idx, 1);
  },
  lookup: (parent, name) => {
    return parent.node_ops.lookup(parent, name);
  },
  mknod: (path, mode, dev) => {
    var lookup = FS.lookupPath(path, { parent: true });
    var parent = lookup.node;
    var name = PATH.basename(path);
    if (!name || name === "." || name === "..") {
      throw new FS.ErrnoError(28);
    }
    var errCode = FS.mayCreate(parent, name);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    if (!parent.node_ops.mknod) {
      throw new FS.ErrnoError(63);
    }
    return parent.node_ops.mknod(parent, name, mode, dev);
  },
  create: (path, mode) => {
    mode = mode !== undefined ? mode : 438;
    mode &= 4095;
    mode |= 32768;
    return FS.mknod(path, mode, 0);
  },
  mkdir: (path, mode) => {
    mode = mode !== undefined ? mode : 511;
    mode &= 511 | 512;
    mode |= 16384;
    return FS.mknod(path, mode, 0);
  },
  mkdirTree: (path, mode) => {
    var dirs = path.split("/");
    var d = "";
    for (var i = 0; i < dirs.length; ++i) {
      if (!dirs[i]) continue;
      d += "/" + dirs[i];
      try {
        FS.mkdir(d, mode);
      } catch (e) {
        if (e.errno != 20) throw e;
      }
    }
  },
  mkdev: (path, mode, dev) => {
    if (typeof dev == "undefined") {
      dev = mode;
      mode = 438;
    }
    mode |= 8192;
    return FS.mknod(path, mode, dev);
  },
  symlink: (oldpath, newpath) => {
    if (!PATH_FS.resolve(oldpath)) {
      throw new FS.ErrnoError(44);
    }
    var lookup = FS.lookupPath(newpath, { parent: true });
    var parent = lookup.node;
    if (!parent) {
      throw new FS.ErrnoError(44);
    }
    var newname = PATH.basename(newpath);
    var errCode = FS.mayCreate(parent, newname);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    if (!parent.node_ops.symlink) {
      throw new FS.ErrnoError(63);
    }
    return parent.node_ops.symlink(parent, newname, oldpath);
  },
  rename: (old_path, new_path) => {
    var old_dirname = PATH.dirname(old_path);
    var new_dirname = PATH.dirname(new_path);
    var old_name = PATH.basename(old_path);
    var new_name = PATH.basename(new_path);
    var lookup, old_dir, new_dir;
    lookup = FS.lookupPath(old_path, { parent: true });
    old_dir = lookup.node;
    lookup = FS.lookupPath(new_path, { parent: true });
    new_dir = lookup.node;
    if (!old_dir || !new_dir) throw new FS.ErrnoError(44);
    if (old_dir.mount !== new_dir.mount) {
      throw new FS.ErrnoError(75);
    }
    var old_node = FS.lookupNode(old_dir, old_name);
    var relative = PATH_FS.relative(old_path, new_dirname);
    if (relative.charAt(0) !== ".") {
      throw new FS.ErrnoError(28);
    }
    relative = PATH_FS.relative(new_path, old_dirname);
    if (relative.charAt(0) !== ".") {
      throw new FS.ErrnoError(55);
    }
    var new_node;
    try {
      new_node = FS.lookupNode(new_dir, new_name);
    } catch (e) {}
    if (old_node === new_node) {
      return;
    }
    var isdir = FS.isDir(old_node.mode);
    var errCode = FS.mayDelete(old_dir, old_name, isdir);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    errCode = new_node
      ? FS.mayDelete(new_dir, new_name, isdir)
      : FS.mayCreate(new_dir, new_name);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    if (!old_dir.node_ops.rename) {
      throw new FS.ErrnoError(63);
    }
    if (FS.isMountpoint(old_node) || (new_node && FS.isMountpoint(new_node))) {
      throw new FS.ErrnoError(10);
    }
    if (new_dir !== old_dir) {
      errCode = FS.nodePermissions(old_dir, "w");
      if (errCode) {
        throw new FS.ErrnoError(errCode);
      }
    }
    FS.hashRemoveNode(old_node);
    try {
      old_dir.node_ops.rename(old_node, new_dir, new_name);
    } catch (e) {
      throw e;
    } finally {
      FS.hashAddNode(old_node);
    }
  },
  rmdir: (path) => {
    var lookup = FS.lookupPath(path, { parent: true });
    var parent = lookup.node;
    var name = PATH.basename(path);
    var node = FS.lookupNode(parent, name);
    var errCode = FS.mayDelete(parent, name, true);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    if (!parent.node_ops.rmdir) {
      throw new FS.ErrnoError(63);
    }
    if (FS.isMountpoint(node)) {
      throw new FS.ErrnoError(10);
    }
    parent.node_ops.rmdir(parent, name);
    FS.destroyNode(node);
  },
  readdir: (path) => {
    var lookup = FS.lookupPath(path, { follow: true });
    var node = lookup.node;
    if (!node.node_ops.readdir) {
      throw new FS.ErrnoError(54);
    }
    return node.node_ops.readdir(node);
  },
  unlink: (path) => {
    var lookup = FS.lookupPath(path, { parent: true });
    var parent = lookup.node;
    if (!parent) {
      throw new FS.ErrnoError(44);
    }
    var name = PATH.basename(path);
    var node = FS.lookupNode(parent, name);
    var errCode = FS.mayDelete(parent, name, false);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    if (!parent.node_ops.unlink) {
      throw new FS.ErrnoError(63);
    }
    if (FS.isMountpoint(node)) {
      throw new FS.ErrnoError(10);
    }
    parent.node_ops.unlink(parent, name);
    FS.destroyNode(node);
  },
  readlink: (path) => {
    var lookup = FS.lookupPath(path);
    var link = lookup.node;
    if (!link) {
      throw new FS.ErrnoError(44);
    }
    if (!link.node_ops.readlink) {
      throw new FS.ErrnoError(28);
    }
    return PATH_FS.resolve(
      FS.getPath(link.parent),
      link.node_ops.readlink(link),
    );
  },
  stat: (path, dontFollow) => {
    var lookup = FS.lookupPath(path, { follow: !dontFollow });
    var node = lookup.node;
    if (!node) {
      throw new FS.ErrnoError(44);
    }
    if (!node.node_ops.getattr) {
      throw new FS.ErrnoError(63);
    }
    return node.node_ops.getattr(node);
  },
  lstat: (path) => {
    return FS.stat(path, true);
  },
  chmod: (path, mode, dontFollow) => {
    var node;
    if (typeof path == "string") {
      var lookup = FS.lookupPath(path, { follow: !dontFollow });
      node = lookup.node;
    } else {
      node = path;
    }
    if (!node.node_ops.setattr) {
      throw new FS.ErrnoError(63);
    }
    node.node_ops.setattr(node, {
      mode: (mode & 4095) | (node.mode & ~4095),
      timestamp: Date.now(),
    });
  },
  lchmod: (path, mode) => {
    FS.chmod(path, mode, true);
  },
  fchmod: (fd, mode) => {
    var stream = FS.getStream(fd);
    if (!stream) {
      throw new FS.ErrnoError(8);
    }
    FS.chmod(stream.node, mode);
  },
  chown: (path, uid, gid, dontFollow) => {
    var node;
    if (typeof path == "string") {
      var lookup = FS.lookupPath(path, { follow: !dontFollow });
      node = lookup.node;
    } else {
      node = path;
    }
    if (!node.node_ops.setattr) {
      throw new FS.ErrnoError(63);
    }
    node.node_ops.setattr(node, { timestamp: Date.now() });
  },
  lchown: (path, uid, gid) => {
    FS.chown(path, uid, gid, true);
  },
  fchown: (fd, uid, gid) => {
    var stream = FS.getStream(fd);
    if (!stream) {
      throw new FS.ErrnoError(8);
    }
    FS.chown(stream.node, uid, gid);
  },
  truncate: (path, len) => {
    if (len < 0) {
      throw new FS.ErrnoError(28);
    }
    var node;
    if (typeof path == "string") {
      var lookup = FS.lookupPath(path, { follow: true });
      node = lookup.node;
    } else {
      node = path;
    }
    if (!node.node_ops.setattr) {
      throw new FS.ErrnoError(63);
    }
    if (FS.isDir(node.mode)) {
      throw new FS.ErrnoError(31);
    }
    if (!FS.isFile(node.mode)) {
      throw new FS.ErrnoError(28);
    }
    var errCode = FS.nodePermissions(node, "w");
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    node.node_ops.setattr(node, { size: len, timestamp: Date.now() });
  },
  ftruncate: (fd, len) => {
    var stream = FS.getStream(fd);
    if (!stream) {
      throw new FS.ErrnoError(8);
    }
    if ((stream.flags & 2097155) === 0) {
      throw new FS.ErrnoError(28);
    }
    FS.truncate(stream.node, len);
  },
  utime: (path, atime, mtime) => {
    var lookup = FS.lookupPath(path, { follow: true });
    var node = lookup.node;
    node.node_ops.setattr(node, { timestamp: Math.max(atime, mtime) });
  },
  open: (path, flags, mode) => {
    if (path === "") {
      throw new FS.ErrnoError(44);
    }
    flags = typeof flags == "string" ? FS.modeStringToFlags(flags) : flags;
    mode = typeof mode == "undefined" ? 438 : mode;
    if (flags & 64) {
      mode = (mode & 4095) | 32768;
    } else {
      mode = 0;
    }
    var node;
    if (typeof path == "object") {
      node = path;
    } else {
      path = PATH.normalize(path);
      try {
        var lookup = FS.lookupPath(path, { follow: !(flags & 131072) });
        node = lookup.node;
      } catch (e) {}
    }
    var created = false;
    if (flags & 64) {
      if (node) {
        if (flags & 128) {
          throw new FS.ErrnoError(20);
        }
      } else {
        node = FS.mknod(path, mode, 0);
        created = true;
      }
    }
    if (!node) {
      throw new FS.ErrnoError(44);
    }
    if (FS.isChrdev(node.mode)) {
      flags &= ~512;
    }
    if (flags & 65536 && !FS.isDir(node.mode)) {
      throw new FS.ErrnoError(54);
    }
    if (!created) {
      var errCode = FS.mayOpen(node, flags);
      if (errCode) {
        throw new FS.ErrnoError(errCode);
      }
    }
    if (flags & 512 && !created) {
      FS.truncate(node, 0);
    }
    flags &= ~(128 | 512 | 131072);
    var stream = FS.createStream({
      node: node,
      path: FS.getPath(node),
      flags: flags,
      seekable: true,
      position: 0,
      stream_ops: node.stream_ops,
      ungotten: [],
      error: false,
    });
    if (stream.stream_ops.open) {
      stream.stream_ops.open(stream);
    }
    if (Module["logReadFiles"] && !(flags & 1)) {
      if (!FS.readFiles) FS.readFiles = {};
      if (!(path in FS.readFiles)) {
        FS.readFiles[path] = 1;
      }
    }
    return stream;
  },
  close: (stream) => {
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(8);
    }
    if (stream.getdents) stream.getdents = null;
    try {
      if (stream.stream_ops.close) {
        stream.stream_ops.close(stream);
      }
    } catch (e) {
      throw e;
    } finally {
      FS.closeStream(stream.fd);
    }
    stream.fd = null;
  },
  isClosed: (stream) => {
    return stream.fd === null;
  },
  llseek: (stream, offset, whence) => {
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(8);
    }
    if (!stream.seekable || !stream.stream_ops.llseek) {
      throw new FS.ErrnoError(70);
    }
    if (whence != 0 && whence != 1 && whence != 2) {
      throw new FS.ErrnoError(28);
    }
    stream.position = stream.stream_ops.llseek(stream, offset, whence);
    stream.ungotten = [];
    return stream.position;
  },
  read: (stream, buffer, offset, length, position) => {
    if (length < 0 || position < 0) {
      throw new FS.ErrnoError(28);
    }
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(8);
    }
    if ((stream.flags & 2097155) === 1) {
      throw new FS.ErrnoError(8);
    }
    if (FS.isDir(stream.node.mode)) {
      throw new FS.ErrnoError(31);
    }
    if (!stream.stream_ops.read) {
      throw new FS.ErrnoError(28);
    }
    var seeking = typeof position != "undefined";
    if (!seeking) {
      position = stream.position;
    } else if (!stream.seekable) {
      throw new FS.ErrnoError(70);
    }
    var bytesRead = stream.stream_ops.read(
      stream,
      buffer,
      offset,
      length,
      position,
    );
    if (!seeking) stream.position += bytesRead;
    return bytesRead;
  },
  write: (stream, buffer, offset, length, position, canOwn) => {
    if (length < 0 || position < 0) {
      throw new FS.ErrnoError(28);
    }
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(8);
    }
    if ((stream.flags & 2097155) === 0) {
      throw new FS.ErrnoError(8);
    }
    if (FS.isDir(stream.node.mode)) {
      throw new FS.ErrnoError(31);
    }
    if (!stream.stream_ops.write) {
      throw new FS.ErrnoError(28);
    }
    if (stream.seekable && stream.flags & 1024) {
      FS.llseek(stream, 0, 2);
    }
    var seeking = typeof position != "undefined";
    if (!seeking) {
      position = stream.position;
    } else if (!stream.seekable) {
      throw new FS.ErrnoError(70);
    }
    var bytesWritten = stream.stream_ops.write(
      stream,
      buffer,
      offset,
      length,
      position,
      canOwn,
    );
    if (!seeking) stream.position += bytesWritten;
    return bytesWritten;
  },
  allocate: (stream, offset, length) => {
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(8);
    }
    if (offset < 0 || length <= 0) {
      throw new FS.ErrnoError(28);
    }
    if ((stream.flags & 2097155) === 0) {
      throw new FS.ErrnoError(8);
    }
    if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
      throw new FS.ErrnoError(43);
    }
    if (!stream.stream_ops.allocate) {
      throw new FS.ErrnoError(138);
    }
    stream.stream_ops.allocate(stream, offset, length);
  },
  mmap: (stream, length, position, prot, flags) => {
    if (
      (prot & 2) !== 0 &&
      (flags & 2) === 0 &&
      (stream.flags & 2097155) !== 2
    ) {
      throw new FS.ErrnoError(2);
    }
    if ((stream.flags & 2097155) === 1) {
      throw new FS.ErrnoError(2);
    }
    if (!stream.stream_ops.mmap) {
      throw new FS.ErrnoError(43);
    }
    return stream.stream_ops.mmap(stream, length, position, prot, flags);
  },
  msync: (stream, buffer, offset, length, mmapFlags) => {
    if (!stream.stream_ops.msync) {
      return 0;
    }
    return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
  },
  munmap: (stream) => 0,
  ioctl: (stream, cmd, arg) => {
    if (!stream.stream_ops.ioctl) {
      throw new FS.ErrnoError(59);
    }
    return stream.stream_ops.ioctl(stream, cmd, arg);
  },
  readFile: (path, opts = {}) => {
    opts.flags = opts.flags || 0;
    opts.encoding = opts.encoding || "binary";
    if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
      throw new Error('Invalid encoding type "' + opts.encoding + '"');
    }
    var ret;
    var stream = FS.open(path, opts.flags);
    var stat = FS.stat(path);
    var length = stat.size;
    var buf = new Uint8Array(length);
    FS.read(stream, buf, 0, length, 0);
    if (opts.encoding === "utf8") {
      ret = UTF8ArrayToString(buf, 0);
    } else if (opts.encoding === "binary") {
      ret = buf;
    }
    FS.close(stream);
    return ret;
  },
  writeFile: (path, data, opts = {}) => {
    opts.flags = opts.flags || 577;
    var stream = FS.open(path, opts.flags, opts.mode);
    if (typeof data == "string") {
      var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
      var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
      FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn);
    } else if (ArrayBuffer.isView(data)) {
      FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn);
    } else {
      throw new Error("Unsupported data type");
    }
    FS.close(stream);
  },
  cwd: () => FS.currentPath,
  chdir: (path) => {
    var lookup = FS.lookupPath(path, { follow: true });
    if (lookup.node === null) {
      throw new FS.ErrnoError(44);
    }
    if (!FS.isDir(lookup.node.mode)) {
      throw new FS.ErrnoError(54);
    }
    var errCode = FS.nodePermissions(lookup.node, "x");
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    FS.currentPath = lookup.path;
  },
  createDefaultDirectories: () => {
    FS.mkdir("/tmp");
    FS.mkdir("/home");
    FS.mkdir("/home/web_user");
  },
  createDefaultDevices: () => {
    FS.mkdir("/dev");
    FS.registerDevice(FS.makedev(1, 3), {
      read: () => 0,
      write: (stream, buffer, offset, length, pos) => length,
    });
    FS.mkdev("/dev/null", FS.makedev(1, 3));
    TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
    TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
    FS.mkdev("/dev/tty", FS.makedev(5, 0));
    FS.mkdev("/dev/tty1", FS.makedev(6, 0));
    var random_device = getRandomDevice();
    FS.createDevice("/dev", "random", random_device);
    FS.createDevice("/dev", "urandom", random_device);
    FS.mkdir("/dev/shm");
    FS.mkdir("/dev/shm/tmp");
  },
  createSpecialDirectories: () => {
    FS.mkdir("/proc");
    var proc_self = FS.mkdir("/proc/self");
    FS.mkdir("/proc/self/fd");
    FS.mount(
      {
        mount: () => {
          var node = FS.createNode(proc_self, "fd", 16384 | 511, 73);
          node.node_ops = {
            lookup: (parent, name) => {
              var fd = +name;
              var stream = FS.getStream(fd);
              if (!stream) throw new FS.ErrnoError(8);
              var ret = {
                parent: null,
                mount: { mountpoint: "fake" },
                node_ops: { readlink: () => stream.path },
              };
              ret.parent = ret;
              return ret;
            },
          };
          return node;
        },
      },
      {},
      "/proc/self/fd",
    );
  },
  createStandardStreams: () => {
    if (Module["stdin"]) {
      FS.createDevice("/dev", "stdin", Module["stdin"]);
    } else {
      FS.symlink("/dev/tty", "/dev/stdin");
    }
    if (Module["stdout"]) {
      FS.createDevice("/dev", "stdout", null, Module["stdout"]);
    } else {
      FS.symlink("/dev/tty", "/dev/stdout");
    }
    if (Module["stderr"]) {
      FS.createDevice("/dev", "stderr", null, Module["stderr"]);
    } else {
      FS.symlink("/dev/tty1", "/dev/stderr");
    }
    var stdin = FS.open("/dev/stdin", 0);
    var stdout = FS.open("/dev/stdout", 1);
    var stderr = FS.open("/dev/stderr", 1);
  },
  ensureErrnoError: () => {
    if (FS.ErrnoError) return;
    FS.ErrnoError = function ErrnoError(errno, node) {
      this.node = node;
      this.setErrno = function (errno) {
        this.errno = errno;
      };
      this.setErrno(errno);
      this.message = "FS error";
    };
    FS.ErrnoError.prototype = new Error();
    FS.ErrnoError.prototype.constructor = FS.ErrnoError;
    [44].forEach((code) => {
      FS.genericErrors[code] = new FS.ErrnoError(code);
      FS.genericErrors[code].stack = "<generic error, no stack>";
    });
  },
  staticInit: () => {
    FS.ensureErrnoError();
    FS.nameTable = new Array(4096);
    FS.mount(MEMFS, {}, "/");
    FS.createDefaultDirectories();
    FS.createDefaultDevices();
    FS.createSpecialDirectories();
    FS.filesystems = { MEMFS: MEMFS };
  },
  init: (input, output, error) => {
    FS.init.initialized = true;
    FS.ensureErrnoError();
    Module["stdin"] = input || Module["stdin"];
    Module["stdout"] = output || Module["stdout"];
    Module["stderr"] = error || Module["stderr"];
    FS.createStandardStreams();
  },
  quit: () => {
    FS.init.initialized = false;
    for (var i = 0; i < FS.streams.length; i++) {
      var stream = FS.streams[i];
      if (!stream) {
        continue;
      }
      FS.close(stream);
    }
  },
  getMode: (canRead, canWrite) => {
    var mode = 0;
    if (canRead) mode |= 292 | 73;
    if (canWrite) mode |= 146;
    return mode;
  },
  findObject: (path, dontResolveLastLink) => {
    var ret = FS.analyzePath(path, dontResolveLastLink);
    if (!ret.exists) {
      return null;
    }
    return ret.object;
  },
  analyzePath: (path, dontResolveLastLink) => {
    try {
      var lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
      path = lookup.path;
    } catch (e) {}
    var ret = {
      isRoot: false,
      exists: false,
      error: 0,
      name: null,
      path: null,
      object: null,
      parentExists: false,
      parentPath: null,
      parentObject: null,
    };
    try {
      var lookup = FS.lookupPath(path, { parent: true });
      ret.parentExists = true;
      ret.parentPath = lookup.path;
      ret.parentObject = lookup.node;
      ret.name = PATH.basename(path);
      lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
      ret.exists = true;
      ret.path = lookup.path;
      ret.object = lookup.node;
      ret.name = lookup.node.name;
      ret.isRoot = lookup.path === "/";
    } catch (e) {
      ret.error = e.errno;
    }
    return ret;
  },
  createPath: (parent, path, canRead, canWrite) => {
    parent = typeof parent == "string" ? parent : FS.getPath(parent);
    var parts = path.split("/").reverse();
    while (parts.length) {
      var part = parts.pop();
      if (!part) continue;
      var current = PATH.join2(parent, part);
      try {
        FS.mkdir(current);
      } catch (e) {}
      parent = current;
    }
    return current;
  },
  createFile: (parent, name, properties, canRead, canWrite) => {
    var path = PATH.join2(
      typeof parent == "string" ? parent : FS.getPath(parent),
      name,
    );
    var mode = FS.getMode(canRead, canWrite);
    return FS.create(path, mode);
  },
  createDataFile: (parent, name, data, canRead, canWrite, canOwn) => {
    var path = name;
    if (parent) {
      parent = typeof parent == "string" ? parent : FS.getPath(parent);
      path = name ? PATH.join2(parent, name) : parent;
    }
    var mode = FS.getMode(canRead, canWrite);
    var node = FS.create(path, mode);
    if (data) {
      if (typeof data == "string") {
        var arr = new Array(data.length);
        for (var i = 0, len = data.length; i < len; ++i)
          arr[i] = data.charCodeAt(i);
        data = arr;
      }
      FS.chmod(node, mode | 146);
      var stream = FS.open(node, 577);
      FS.write(stream, data, 0, data.length, 0, canOwn);
      FS.close(stream);
      FS.chmod(node, mode);
    }
    return node;
  },
  createDevice: (parent, name, input, output) => {
    var path = PATH.join2(
      typeof parent == "string" ? parent : FS.getPath(parent),
      name,
    );
    var mode = FS.getMode(!!input, !!output);
    if (!FS.createDevice.major) FS.createDevice.major = 64;
    var dev = FS.makedev(FS.createDevice.major++, 0);
    FS.registerDevice(dev, {
      open: (stream) => {
        stream.seekable = false;
      },
      close: (stream) => {
        if (output && output.buffer && output.buffer.length) {
          output(10);
        }
      },
      read: (stream, buffer, offset, length, pos) => {
        var bytesRead = 0;
        for (var i = 0; i < length; i++) {
          var result;
          try {
            result = input();
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
          if (result === undefined && bytesRead === 0) {
            throw new FS.ErrnoError(6);
          }
          if (result === null || result === undefined) break;
          bytesRead++;
          buffer[offset + i] = result;
        }
        if (bytesRead) {
          stream.node.timestamp = Date.now();
        }
        return bytesRead;
      },
      write: (stream, buffer, offset, length, pos) => {
        for (var i = 0; i < length; i++) {
          try {
            output(buffer[offset + i]);
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
        }
        if (length) {
          stream.node.timestamp = Date.now();
        }
        return i;
      },
    });
    return FS.mkdev(path, mode, dev);
  },
  forceLoadFile: (obj) => {
    if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
    if (typeof XMLHttpRequest != "undefined") {
      throw new Error(
        "Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.",
      );
    } else if (read_) {
      try {
        obj.contents = intArrayFromString(read_(obj.url), true);
        obj.usedBytes = obj.contents.length;
      } catch (e) {
        throw new FS.ErrnoError(29);
      }
    } else {
      throw new Error("Cannot load without read() or XMLHttpRequest.");
    }
  },
  createLazyFile: (parent, name, url, canRead, canWrite) => {
    function LazyUint8Array() {
      this.lengthKnown = false;
      this.chunks = [];
    }
    LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
      if (idx > this.length - 1 || idx < 0) {
        return undefined;
      }
      var chunkOffset = idx % this.chunkSize;
      var chunkNum = (idx / this.chunkSize) | 0;
      return this.getter(chunkNum)[chunkOffset];
    };
    LazyUint8Array.prototype.setDataGetter =
      function LazyUint8Array_setDataGetter(getter) {
        this.getter = getter;
      };
    LazyUint8Array.prototype.cacheLength =
      function LazyUint8Array_cacheLength() {
        var xhr = new XMLHttpRequest();
        xhr.open("HEAD", url, false);
        xhr.send(null);
        if (!((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304))
          throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
        var datalength = Number(xhr.getResponseHeader("Content-length"));
        var header;
        var hasByteServing =
          (header = xhr.getResponseHeader("Accept-Ranges")) &&
          header === "bytes";
        var usesGzip =
          (header = xhr.getResponseHeader("Content-Encoding")) &&
          header === "gzip";
        var chunkSize = 1024 * 1024;
        if (!hasByteServing) chunkSize = datalength;
        var doXHR = (from, to) => {
          if (from > to)
            throw new Error(
              "invalid range (" + from + ", " + to + ") or no bytes requested!",
            );
          if (to > datalength - 1)
            throw new Error(
              "only " + datalength + " bytes available! programmer error!",
            );
          var xhr = new XMLHttpRequest();
          xhr.open("GET", url, false);
          if (datalength !== chunkSize)
            xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
          xhr.responseType = "arraybuffer";
          if (xhr.overrideMimeType) {
            xhr.overrideMimeType("text/plain; charset=x-user-defined");
          }
          xhr.send(null);
          if (!((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304))
            throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
          if (xhr.response !== undefined) {
            return new Uint8Array(xhr.response || []);
          }
          return intArrayFromString(xhr.responseText || "", true);
        };
        var lazyArray = this;
        lazyArray.setDataGetter((chunkNum) => {
          var start = chunkNum * chunkSize;
          var end = (chunkNum + 1) * chunkSize - 1;
          end = Math.min(end, datalength - 1);
          if (typeof lazyArray.chunks[chunkNum] == "undefined") {
            lazyArray.chunks[chunkNum] = doXHR(start, end);
          }
          if (typeof lazyArray.chunks[chunkNum] == "undefined")
            throw new Error("doXHR failed!");
          return lazyArray.chunks[chunkNum];
        });
        if (usesGzip || !datalength) {
          chunkSize = datalength = 1;
          datalength = this.getter(0).length;
          chunkSize = datalength;
          out(
            "LazyFiles on gzip forces download of the whole file when length is accessed",
          );
        }
        this._length = datalength;
        this._chunkSize = chunkSize;
        this.lengthKnown = true;
      };
    if (typeof XMLHttpRequest != "undefined") {
      if (!ENVIRONMENT_IS_WORKER)
        throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
      var lazyArray = new LazyUint8Array();
      Object.defineProperties(lazyArray, {
        length: {
          get: function () {
            if (!this.lengthKnown) {
              this.cacheLength();
            }
            return this._length;
          },
        },
        chunkSize: {
          get: function () {
            if (!this.lengthKnown) {
              this.cacheLength();
            }
            return this._chunkSize;
          },
        },
      });
      var properties = { isDevice: false, contents: lazyArray };
    } else {
      var properties = { isDevice: false, url: url };
    }
    var node = FS.createFile(parent, name, properties, canRead, canWrite);
    if (properties.contents) {
      node.contents = properties.contents;
    } else if (properties.url) {
      node.contents = null;
      node.url = properties.url;
    }
    Object.defineProperties(node, {
      usedBytes: {
        get: function () {
          return this.contents.length;
        },
      },
    });
    var stream_ops = {};
    var keys = Object.keys(node.stream_ops);
    keys.forEach((key) => {
      var fn = node.stream_ops[key];
      stream_ops[key] = function forceLoadLazyFile() {
        FS.forceLoadFile(node);
        return fn.apply(null, arguments);
      };
    });
    function writeChunks(stream, buffer, offset, length, position) {
      var contents = stream.node.contents;
      if (position >= contents.length) return 0;
      var size = Math.min(contents.length - position, length);
      if (contents.slice) {
        for (var i = 0; i < size; i++) {
          buffer[offset + i] = contents[position + i];
        }
      } else {
        for (var i = 0; i < size; i++) {
          buffer[offset + i] = contents.get(position + i);
        }
      }
      return size;
    }
    stream_ops.read = (stream, buffer, offset, length, position) => {
      FS.forceLoadFile(node);
      return writeChunks(stream, buffer, offset, length, position);
    };
    stream_ops.mmap = (stream, length, position, prot, flags) => {
      FS.forceLoadFile(node);
      var ptr = mmapAlloc(length);
      if (!ptr) {
        throw new FS.ErrnoError(48);
      }
      writeChunks(stream, HEAP8, ptr, length, position);
      return { ptr: ptr, allocated: true };
    };
    node.stream_ops = stream_ops;
    return node;
  },
  createPreloadedFile: (
    parent,
    name,
    url,
    canRead,
    canWrite,
    onload,
    onerror,
    dontCreateFile,
    canOwn,
    preFinish,
  ) => {
    var fullname = name ? PATH_FS.resolve(PATH.join2(parent, name)) : parent;
    var dep = getUniqueRunDependency("cp " + fullname);
    function processData(byteArray) {
      function finish(byteArray) {
        if (preFinish) preFinish();
        if (!dontCreateFile) {
          FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
        }
        if (onload) onload();
        removeRunDependency(dep);
      }
      if (
        Browser.handledByPreloadPlugin(byteArray, fullname, finish, () => {
          if (onerror) onerror();
          removeRunDependency(dep);
        })
      ) {
        return;
      }
      finish(byteArray);
    }
    addRunDependency(dep);
    if (typeof url == "string") {
      asyncLoad(url, (byteArray) => processData(byteArray), onerror);
    } else {
      processData(url);
    }
  },
  indexedDB: () => {
    return (
      window.indexedDB ||
      window.mozIndexedDB ||
      window.webkitIndexedDB ||
      window.msIndexedDB
    );
  },
  DB_NAME: () => {
    return "EM_FS_" + window.location.pathname;
  },
  DB_VERSION: 20,
  DB_STORE_NAME: "FILE_DATA",
  saveFilesToDB: (paths, onload, onerror) => {
    onload = onload || (() => {});
    onerror = onerror || (() => {});
    var indexedDB = FS.indexedDB();
    try {
      var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
    } catch (e) {
      return onerror(e);
    }
    openRequest.onupgradeneeded = () => {
      out("creating db");
      var db = openRequest.result;
      db.createObjectStore(FS.DB_STORE_NAME);
    };
    openRequest.onsuccess = () => {
      var db = openRequest.result;
      var transaction = db.transaction([FS.DB_STORE_NAME], "readwrite");
      var files = transaction.objectStore(FS.DB_STORE_NAME);
      var ok = 0,
        fail = 0,
        total = paths.length;
      function finish() {
        if (fail == 0) onload();
        else onerror();
      }
      paths.forEach((path) => {
        var putRequest = files.put(FS.analyzePath(path).object.contents, path);
        putRequest.onsuccess = () => {
          ok++;
          if (ok + fail == total) finish();
        };
        putRequest.onerror = () => {
          fail++;
          if (ok + fail == total) finish();
        };
      });
      transaction.onerror = onerror;
    };
    openRequest.onerror = onerror;
  },
  loadFilesFromDB: (paths, onload, onerror) => {
    onload = onload || (() => {});
    onerror = onerror || (() => {});
    var indexedDB = FS.indexedDB();
    try {
      var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
    } catch (e) {
      return onerror(e);
    }
    openRequest.onupgradeneeded = onerror;
    openRequest.onsuccess = () => {
      var db = openRequest.result;
      try {
        var transaction = db.transaction([FS.DB_STORE_NAME], "readonly");
      } catch (e) {
        onerror(e);
        return;
      }
      var files = transaction.objectStore(FS.DB_STORE_NAME);
      var ok = 0,
        fail = 0,
        total = paths.length;
      function finish() {
        if (fail == 0) onload();
        else onerror();
      }
      paths.forEach((path) => {
        var getRequest = files.get(path);
        getRequest.onsuccess = () => {
          if (FS.analyzePath(path).exists) {
            FS.unlink(path);
          }
          FS.createDataFile(
            PATH.dirname(path),
            PATH.basename(path),
            getRequest.result,
            true,
            true,
            true,
          );
          ok++;
          if (ok + fail == total) finish();
        };
        getRequest.onerror = () => {
          fail++;
          if (ok + fail == total) finish();
        };
      });
      transaction.onerror = onerror;
    };
    openRequest.onerror = onerror;
  },
};
var SYSCALLS = {
  DEFAULT_POLLMASK: 5,
  calculateAt: function (dirfd, path, allowEmpty) {
    if (PATH.isAbs(path)) {
      return path;
    }
    var dir;
    if (dirfd === -100) {
      dir = FS.cwd();
    } else {
      var dirstream = SYSCALLS.getStreamFromFD(dirfd);
      dir = dirstream.path;
    }
    if (path.length == 0) {
      if (!allowEmpty) {
        throw new FS.ErrnoError(44);
      }
      return dir;
    }
    return PATH.join2(dir, path);
  },
  doStat: function (func, path, buf) {
    try {
      var stat = func(path);
    } catch (e) {
      if (
        e &&
        e.node &&
        PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))
      ) {
        return -54;
      }
      throw e;
    }
    HEAP32[buf >> 2] = stat.dev;
    HEAP32[(buf + 8) >> 2] = stat.ino;
    HEAP32[(buf + 12) >> 2] = stat.mode;
    HEAPU32[(buf + 16) >> 2] = stat.nlink;
    HEAP32[(buf + 20) >> 2] = stat.uid;
    HEAP32[(buf + 24) >> 2] = stat.gid;
    HEAP32[(buf + 28) >> 2] = stat.rdev;
    (tempI64 = [
      stat.size >>> 0,
      ((tempDouble = stat.size),
      +Math.abs(tempDouble) >= 1
        ? tempDouble > 0
          ? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>>
            0
          : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>>
            0
        : 0),
    ]),
      (HEAP32[(buf + 40) >> 2] = tempI64[0]),
      (HEAP32[(buf + 44) >> 2] = tempI64[1]);
    HEAP32[(buf + 48) >> 2] = 4096;
    HEAP32[(buf + 52) >> 2] = stat.blocks;
    var atime = stat.atime.getTime();
    var mtime = stat.mtime.getTime();
    var ctime = stat.ctime.getTime();
    (tempI64 = [
      Math.floor(atime / 1e3) >>> 0,
      ((tempDouble = Math.floor(atime / 1e3)),
      +Math.abs(tempDouble) >= 1
        ? tempDouble > 0
          ? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>>
            0
          : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>>
            0
        : 0),
    ]),
      (HEAP32[(buf + 56) >> 2] = tempI64[0]),
      (HEAP32[(buf + 60) >> 2] = tempI64[1]);
    HEAPU32[(buf + 64) >> 2] = (atime % 1e3) * 1e3;
    (tempI64 = [
      Math.floor(mtime / 1e3) >>> 0,
      ((tempDouble = Math.floor(mtime / 1e3)),
      +Math.abs(tempDouble) >= 1
        ? tempDouble > 0
          ? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>>
            0
          : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>>
            0
        : 0),
    ]),
      (HEAP32[(buf + 72) >> 2] = tempI64[0]),
      (HEAP32[(buf + 76) >> 2] = tempI64[1]);
    HEAPU32[(buf + 80) >> 2] = (mtime % 1e3) * 1e3;
    (tempI64 = [
      Math.floor(ctime / 1e3) >>> 0,
      ((tempDouble = Math.floor(ctime / 1e3)),
      +Math.abs(tempDouble) >= 1
        ? tempDouble > 0
          ? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>>
            0
          : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>>
            0
        : 0),
    ]),
      (HEAP32[(buf + 88) >> 2] = tempI64[0]),
      (HEAP32[(buf + 92) >> 2] = tempI64[1]);
    HEAPU32[(buf + 96) >> 2] = (ctime % 1e3) * 1e3;
    (tempI64 = [
      stat.ino >>> 0,
      ((tempDouble = stat.ino),
      +Math.abs(tempDouble) >= 1
        ? tempDouble > 0
          ? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>>
            0
          : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>>
            0
        : 0),
    ]),
      (HEAP32[(buf + 104) >> 2] = tempI64[0]),
      (HEAP32[(buf + 108) >> 2] = tempI64[1]);
    return 0;
  },
  doMsync: function (addr, stream, len, flags, offset) {
    if (!FS.isFile(stream.node.mode)) {
      throw new FS.ErrnoError(43);
    }
    if (flags & 2) {
      return 0;
    }
    var buffer = HEAPU8.slice(addr, addr + len);
    FS.msync(stream, buffer, offset, len, flags);
  },
  varargs: undefined,
  get: function () {
    SYSCALLS.varargs += 4;
    var ret = HEAP32[(SYSCALLS.varargs - 4) >> 2];
    return ret;
  },
  getStr: function (ptr) {
    var ret = UTF8ToString(ptr);
    return ret;
  },
  getStreamFromFD: function (fd) {
    var stream = FS.getStream(fd);
    if (!stream) throw new FS.ErrnoError(8);
    return stream;
  },
};
function ___syscall_fcntl64(fd, cmd, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    switch (cmd) {
      case 0: {
        var arg = SYSCALLS.get();
        if (arg < 0) {
          return -28;
        }
        var newStream;
        newStream = FS.createStream(stream, arg);
        return newStream.fd;
      }
      case 1:
      case 2:
        return 0;
      case 3:
        return stream.flags;
      case 4: {
        var arg = SYSCALLS.get();
        stream.flags |= arg;
        return 0;
      }
      case 5: {
        var arg = SYSCALLS.get();
        var offset = 0;
        HEAP16[(arg + offset) >> 1] = 2;
        return 0;
      }
      case 6:
      case 7:
        return 0;
      case 16:
      case 8:
        return -28;
      case 9:
        setErrNo(28);
        return -1;
      default: {
        return -28;
      }
    }
  } catch (e) {
    if (typeof FS == "undefined" || !(e instanceof FS.ErrnoError)) throw e;
    return -e.errno;
  }
}
function ___syscall_getdents64(fd, dirp, count) {
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    if (!stream.getdents) {
      stream.getdents = FS.readdir(stream.path);
    }
    var struct_size = 280;
    var pos = 0;
    var off = FS.llseek(stream, 0, 1);
    var idx = Math.floor(off / struct_size);
    while (idx < stream.getdents.length && pos + struct_size <= count) {
      var id;
      var type;
      var name = stream.getdents[idx];
      if (name === ".") {
        id = stream.node.id;
        type = 4;
      } else if (name === "..") {
        var lookup = FS.lookupPath(stream.path, { parent: true });
        id = lookup.node.id;
        type = 4;
      } else {
        var child = FS.lookupNode(stream.node, name);
        id = child.id;
        type = FS.isChrdev(child.mode)
          ? 2
          : FS.isDir(child.mode)
            ? 4
            : FS.isLink(child.mode)
              ? 10
              : 8;
      }
      (tempI64 = [
        id >>> 0,
        ((tempDouble = id),
        +Math.abs(tempDouble) >= 1
          ? tempDouble > 0
            ? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) |
                0) >>>
              0
            : ~~+Math.ceil(
                (tempDouble - +(~~tempDouble >>> 0)) / 4294967296,
              ) >>> 0
          : 0),
      ]),
        (HEAP32[(dirp + pos) >> 2] = tempI64[0]),
        (HEAP32[(dirp + pos + 4) >> 2] = tempI64[1]);
      (tempI64 = [
        ((idx + 1) * struct_size) >>> 0,
        ((tempDouble = (idx + 1) * struct_size),
        +Math.abs(tempDouble) >= 1
          ? tempDouble > 0
            ? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) |
                0) >>>
              0
            : ~~+Math.ceil(
                (tempDouble - +(~~tempDouble >>> 0)) / 4294967296,
              ) >>> 0
          : 0),
      ]),
        (HEAP32[(dirp + pos + 8) >> 2] = tempI64[0]),
        (HEAP32[(dirp + pos + 12) >> 2] = tempI64[1]);
      HEAP16[(dirp + pos + 16) >> 1] = 280;
      HEAP8[(dirp + pos + 18) >> 0] = type;
      stringToUTF8(name, dirp + pos + 19, 256);
      pos += struct_size;
      idx += 1;
    }
    FS.llseek(stream, idx * struct_size, 0);
    return pos;
  } catch (e) {
    if (typeof FS == "undefined" || !(e instanceof FS.ErrnoError)) throw e;
    return -e.errno;
  }
}
function ___syscall_ioctl(fd, op, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    switch (op) {
      case 21509:
      case 21505: {
        if (!stream.tty) return -59;
        return 0;
      }
      case 21510:
      case 21511:
      case 21512:
      case 21506:
      case 21507:
      case 21508: {
        if (!stream.tty) return -59;
        return 0;
      }
      case 21519: {
        if (!stream.tty) return -59;
        var argp = SYSCALLS.get();
        HEAP32[argp >> 2] = 0;
        return 0;
      }
      case 21520: {
        if (!stream.tty) return -59;
        return -28;
      }
      case 21531: {
        var argp = SYSCALLS.get();
        return FS.ioctl(stream, op, argp);
      }
      case 21523: {
        if (!stream.tty) return -59;
        return 0;
      }
      case 21524: {
        if (!stream.tty) return -59;
        return 0;
      }
      default:
        return -28;
    }
  } catch (e) {
    if (typeof FS == "undefined" || !(e instanceof FS.ErrnoError)) throw e;
    return -e.errno;
  }
}
function ___syscall_openat(dirfd, path, flags, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    path = SYSCALLS.getStr(path);
    path = SYSCALLS.calculateAt(dirfd, path);
    var mode = varargs ? SYSCALLS.get() : 0;
    return FS.open(path, flags, mode).fd;
  } catch (e) {
    if (typeof FS == "undefined" || !(e instanceof FS.ErrnoError)) throw e;
    return -e.errno;
  }
}
function ___syscall_rmdir(path) {
  try {
    path = SYSCALLS.getStr(path);
    FS.rmdir(path);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e instanceof FS.ErrnoError)) throw e;
    return -e.errno;
  }
}
function ___syscall_stat64(path, buf) {
  try {
    path = SYSCALLS.getStr(path);
    return SYSCALLS.doStat(FS.stat, path, buf);
  } catch (e) {
    if (typeof FS == "undefined" || !(e instanceof FS.ErrnoError)) throw e;
    return -e.errno;
  }
}
function ___syscall_unlinkat(dirfd, path, flags) {
  try {
    path = SYSCALLS.getStr(path);
    path = SYSCALLS.calculateAt(dirfd, path);
    if (flags === 0) {
      FS.unlink(path);
    } else if (flags === 512) {
      FS.rmdir(path);
    } else {
      abort("Invalid flags passed to unlinkat");
    }
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e instanceof FS.ErrnoError)) throw e;
    return -e.errno;
  }
}
var nowIsMonotonic = true;
function __emscripten_get_now_is_monotonic() {
  return nowIsMonotonic;
}
function _abort() {
  abort("");
}
function _emscripten_date_now() {
  return Date.now();
}
var _emscripten_get_now;
if (ENVIRONMENT_IS_NODE) {
  _emscripten_get_now = () => {
    var t = process["hrtime"]();
    return t[0] * 1e3 + t[1] / 1e6;
  };
} else _emscripten_get_now = () => performance.now();
function _emscripten_memcpy_big(dest, src, num) {
  HEAPU8.copyWithin(dest, src, src + num);
}
function abortOnCannotGrowMemory(requestedSize) {
  abort("OOM");
}
function _emscripten_resize_heap(requestedSize) {
  var oldSize = HEAPU8.length;
  requestedSize = requestedSize >>> 0;
  abortOnCannotGrowMemory(requestedSize);
}
var ENV = {};
function getExecutableName() {
  return thisProgram || "./this.program";
}
function getEnvStrings() {
  if (!getEnvStrings.strings) {
    var lang =
      (
        (typeof navigator == "object" &&
          navigator.languages &&
          navigator.languages[0]) ||
        "C"
      ).replace("-", "_") + ".UTF-8";
    var env = {
      USER: "web_user",
      LOGNAME: "web_user",
      PATH: "/",
      PWD: "/",
      HOME: "/home/web_user",
      LANG: lang,
      _: getExecutableName(),
    };
    for (var x in ENV) {
      if (ENV[x] === undefined) delete env[x];
      else env[x] = ENV[x];
    }
    var strings = [];
    for (var x in env) {
      strings.push(x + "=" + env[x]);
    }
    getEnvStrings.strings = strings;
  }
  return getEnvStrings.strings;
}
function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    HEAP8[buffer++ >> 0] = str.charCodeAt(i);
  }
  if (!dontAddNull) HEAP8[buffer >> 0] = 0;
}
function _environ_get(__environ, environ_buf) {
  var bufSize = 0;
  getEnvStrings().forEach(function (string, i) {
    var ptr = environ_buf + bufSize;
    HEAPU32[(__environ + i * 4) >> 2] = ptr;
    writeAsciiToMemory(string, ptr);
    bufSize += string.length + 1;
  });
  return 0;
}
function _environ_sizes_get(penviron_count, penviron_buf_size) {
  var strings = getEnvStrings();
  HEAPU32[penviron_count >> 2] = strings.length;
  var bufSize = 0;
  strings.forEach(function (string) {
    bufSize += string.length + 1;
  });
  HEAPU32[penviron_buf_size >> 2] = bufSize;
  return 0;
}
function _fd_close(fd) {
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    FS.close(stream);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e instanceof FS.ErrnoError)) throw e;
    return e.errno;
  }
}
function doReadv(stream, iov, iovcnt, offset) {
  var ret = 0;
  for (var i = 0; i < iovcnt; i++) {
    var ptr = HEAPU32[iov >> 2];
    var len = HEAPU32[(iov + 4) >> 2];
    iov += 8;
    var curr = FS.read(stream, HEAP8, ptr, len, offset);
    if (curr < 0) return -1;
    ret += curr;
    if (curr < len) break;
    if (typeof offset !== "undefined") {
      offset += curr;
    }
  }
  return ret;
}
function _fd_read(fd, iov, iovcnt, pnum) {
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    var num = doReadv(stream, iov, iovcnt);
    HEAPU32[pnum >> 2] = num;
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e instanceof FS.ErrnoError)) throw e;
    return e.errno;
  }
}
function convertI32PairToI53Checked(lo, hi) {
  return (hi + 2097152) >>> 0 < 4194305 - !!lo
    ? (lo >>> 0) + hi * 4294967296
    : NaN;
}
function _fd_seek(fd, offset_low, offset_high, whence, newOffset) {
  try {
    var offset = convertI32PairToI53Checked(offset_low, offset_high);
    if (isNaN(offset)) return 61;
    var stream = SYSCALLS.getStreamFromFD(fd);
    FS.llseek(stream, offset, whence);
    (tempI64 = [
      stream.position >>> 0,
      ((tempDouble = stream.position),
      +Math.abs(tempDouble) >= 1
        ? tempDouble > 0
          ? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>>
            0
          : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>>
            0
        : 0),
    ]),
      (HEAP32[newOffset >> 2] = tempI64[0]),
      (HEAP32[(newOffset + 4) >> 2] = tempI64[1]);
    if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null;
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e instanceof FS.ErrnoError)) throw e;
    return e.errno;
  }
}
function doWritev(stream, iov, iovcnt, offset) {
  var ret = 0;
  for (var i = 0; i < iovcnt; i++) {
    var ptr = HEAPU32[iov >> 2];
    var len = HEAPU32[(iov + 4) >> 2];
    iov += 8;
    var curr = FS.write(stream, HEAP8, ptr, len, offset);
    if (curr < 0) return -1;
    ret += curr;
    if (typeof offset !== "undefined") {
      offset += curr;
    }
  }
  return ret;
}
function _fd_write(fd, iov, iovcnt, pnum) {
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    var num = doWritev(stream, iov, iovcnt);
    HEAPU32[pnum >> 2] = num;
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e instanceof FS.ErrnoError)) throw e;
    return e.errno;
  }
}
var FSNode = function (parent, name, mode, rdev) {
  if (!parent) {
    parent = this;
  }
  this.parent = parent;
  this.mount = parent.mount;
  this.mounted = null;
  this.id = FS.nextInode++;
  this.name = name;
  this.mode = mode;
  this.node_ops = {};
  this.stream_ops = {};
  this.rdev = rdev;
};
var readMode = 292 | 73;
var writeMode = 146;
Object.defineProperties(FSNode.prototype, {
  read: {
    get: function () {
      return (this.mode & readMode) === readMode;
    },
    set: function (val) {
      val ? (this.mode |= readMode) : (this.mode &= ~readMode);
    },
  },
  write: {
    get: function () {
      return (this.mode & writeMode) === writeMode;
    },
    set: function (val) {
      val ? (this.mode |= writeMode) : (this.mode &= ~writeMode);
    },
  },
  isFolder: {
    get: function () {
      return FS.isDir(this.mode);
    },
  },
  isDevice: {
    get: function () {
      return FS.isChrdev(this.mode);
    },
  },
});
FS.FSNode = FSNode;
FS.staticInit();
Module["FS_createPath"] = FS.createPath;
Module["FS_createDataFile"] = FS.createDataFile;
Module["FS_createPreloadedFile"] = FS.createPreloadedFile;
Module["FS_unlink"] = FS.unlink;
Module["FS_createLazyFile"] = FS.createLazyFile;
Module["FS_createDevice"] = FS.createDevice;
var ASSERTIONS = false;
var decodeBase64 =
  typeof atob == "function"
    ? atob
    : function (input) {
        var keyStr =
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        var output = "";
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;
        input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
        do {
          enc1 = keyStr.indexOf(input.charAt(i++));
          enc2 = keyStr.indexOf(input.charAt(i++));
          enc3 = keyStr.indexOf(input.charAt(i++));
          enc4 = keyStr.indexOf(input.charAt(i++));
          chr1 = (enc1 << 2) | (enc2 >> 4);
          chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
          chr3 = ((enc3 & 3) << 6) | enc4;
          output = output + String.fromCharCode(chr1);
          if (enc3 !== 64) {
            output = output + String.fromCharCode(chr2);
          }
          if (enc4 !== 64) {
            output = output + String.fromCharCode(chr3);
          }
        } while (i < input.length);
        return output;
      };
function intArrayFromBase64(s) {
  if (typeof ENVIRONMENT_IS_NODE == "boolean" && ENVIRONMENT_IS_NODE) {
    var buf = Buffer.from(s, "base64");
    return new Uint8Array(buf["buffer"], buf["byteOffset"], buf["byteLength"]);
  }
  try {
    var decoded = decodeBase64(s);
    var bytes = new Uint8Array(decoded.length);
    for (var i = 0; i < decoded.length; ++i) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  } catch (_) {
    throw new Error("Converting base64 string to bytes failed.");
  }
}
function tryParseAsDataURI(filename) {
  if (!isDataURI(filename)) {
    return;
  }
  return intArrayFromBase64(filename.slice(dataURIPrefix.length));
}
var asmLibraryArg = {
  g: ___assert_fail,
  u: ___cxa_throw,
  d: ___syscall_fcntl64,
  q: ___syscall_getdents64,
  h: ___syscall_ioctl,
  e: ___syscall_openat,
  o: ___syscall_rmdir,
  n: ___syscall_stat64,
  p: ___syscall_unlinkat,
  i: __emscripten_get_now_is_monotonic,
  l: _abort,
  f: _emscripten_date_now,
  j: _emscripten_memcpy_big,
  m: _emscripten_resize_heap,
  r: _environ_get,
  s: _environ_sizes_get,
  b: _fd_close,
  t: _fd_read,
  k: _fd_seek,
  c: _fd_write,
  a: wasmMemory,
};
var asm = createWasm();
var ___wasm_call_ctors = (Module["___wasm_call_ctors"] = function () {
  return (___wasm_call_ctors = Module["___wasm_call_ctors"] =
    Module["asm"]["v"]).apply(null, arguments);
});
var _emscripten_bind_VoidPtr___destroy___0 = (Module[
  "_emscripten_bind_VoidPtr___destroy___0"
] = function () {
  return (_emscripten_bind_VoidPtr___destroy___0 = Module[
    "_emscripten_bind_VoidPtr___destroy___0"
  ] =
    Module["asm"]["w"]).apply(null, arguments);
});
var _emscripten_bind_espeak_VOICE_get_name_0 = (Module[
  "_emscripten_bind_espeak_VOICE_get_name_0"
] = function () {
  return (_emscripten_bind_espeak_VOICE_get_name_0 = Module[
    "_emscripten_bind_espeak_VOICE_get_name_0"
  ] =
    Module["asm"]["x"]).apply(null, arguments);
});
var _emscripten_bind_espeak_VOICE_set_name_1 = (Module[
  "_emscripten_bind_espeak_VOICE_set_name_1"
] = function () {
  return (_emscripten_bind_espeak_VOICE_set_name_1 = Module[
    "_emscripten_bind_espeak_VOICE_set_name_1"
  ] =
    Module["asm"]["y"]).apply(null, arguments);
});
var _emscripten_bind_espeak_VOICE_get_languages_1 = (Module[
  "_emscripten_bind_espeak_VOICE_get_languages_1"
] = function () {
  return (_emscripten_bind_espeak_VOICE_get_languages_1 = Module[
    "_emscripten_bind_espeak_VOICE_get_languages_1"
  ] =
    Module["asm"]["z"]).apply(null, arguments);
});
var _emscripten_bind_espeak_VOICE_get_identifier_0 = (Module[
  "_emscripten_bind_espeak_VOICE_get_identifier_0"
] = function () {
  return (_emscripten_bind_espeak_VOICE_get_identifier_0 = Module[
    "_emscripten_bind_espeak_VOICE_get_identifier_0"
  ] =
    Module["asm"]["A"]).apply(null, arguments);
});
var _emscripten_bind_espeak_VOICE_set_identifier_1 = (Module[
  "_emscripten_bind_espeak_VOICE_set_identifier_1"
] = function () {
  return (_emscripten_bind_espeak_VOICE_set_identifier_1 = Module[
    "_emscripten_bind_espeak_VOICE_set_identifier_1"
  ] =
    Module["asm"]["B"]).apply(null, arguments);
});
var _emscripten_bind_espeak_VOICE_get_gender_0 = (Module[
  "_emscripten_bind_espeak_VOICE_get_gender_0"
] = function () {
  return (_emscripten_bind_espeak_VOICE_get_gender_0 = Module[
    "_emscripten_bind_espeak_VOICE_get_gender_0"
  ] =
    Module["asm"]["C"]).apply(null, arguments);
});
var _emscripten_bind_espeak_VOICE_set_gender_1 = (Module[
  "_emscripten_bind_espeak_VOICE_set_gender_1"
] = function () {
  return (_emscripten_bind_espeak_VOICE_set_gender_1 = Module[
    "_emscripten_bind_espeak_VOICE_set_gender_1"
  ] =
    Module["asm"]["D"]).apply(null, arguments);
});
var _emscripten_bind_espeak_VOICE_get_age_0 = (Module[
  "_emscripten_bind_espeak_VOICE_get_age_0"
] = function () {
  return (_emscripten_bind_espeak_VOICE_get_age_0 = Module[
    "_emscripten_bind_espeak_VOICE_get_age_0"
  ] =
    Module["asm"]["E"]).apply(null, arguments);
});
var _emscripten_bind_espeak_VOICE_set_age_1 = (Module[
  "_emscripten_bind_espeak_VOICE_set_age_1"
] = function () {
  return (_emscripten_bind_espeak_VOICE_set_age_1 = Module[
    "_emscripten_bind_espeak_VOICE_set_age_1"
  ] =
    Module["asm"]["F"]).apply(null, arguments);
});
var _emscripten_bind_espeak_VOICE_get_variant_0 = (Module[
  "_emscripten_bind_espeak_VOICE_get_variant_0"
] = function () {
  return (_emscripten_bind_espeak_VOICE_get_variant_0 = Module[
    "_emscripten_bind_espeak_VOICE_get_variant_0"
  ] =
    Module["asm"]["G"]).apply(null, arguments);
});
var _emscripten_bind_espeak_VOICE_set_variant_1 = (Module[
  "_emscripten_bind_espeak_VOICE_set_variant_1"
] = function () {
  return (_emscripten_bind_espeak_VOICE_set_variant_1 = Module[
    "_emscripten_bind_espeak_VOICE_set_variant_1"
  ] =
    Module["asm"]["H"]).apply(null, arguments);
});
var _emscripten_bind_espeak_VOICE_get_xx1_0 = (Module[
  "_emscripten_bind_espeak_VOICE_get_xx1_0"
] = function () {
  return (_emscripten_bind_espeak_VOICE_get_xx1_0 = Module[
    "_emscripten_bind_espeak_VOICE_get_xx1_0"
  ] =
    Module["asm"]["I"]).apply(null, arguments);
});
var _emscripten_bind_espeak_VOICE_set_xx1_1 = (Module[
  "_emscripten_bind_espeak_VOICE_set_xx1_1"
] = function () {
  return (_emscripten_bind_espeak_VOICE_set_xx1_1 = Module[
    "_emscripten_bind_espeak_VOICE_set_xx1_1"
  ] =
    Module["asm"]["J"]).apply(null, arguments);
});
var _emscripten_bind_espeak_VOICE_get_score_0 = (Module[
  "_emscripten_bind_espeak_VOICE_get_score_0"
] = function () {
  return (_emscripten_bind_espeak_VOICE_get_score_0 = Module[
    "_emscripten_bind_espeak_VOICE_get_score_0"
  ] =
    Module["asm"]["K"]).apply(null, arguments);
});
var _emscripten_bind_espeak_VOICE_set_score_1 = (Module[
  "_emscripten_bind_espeak_VOICE_set_score_1"
] = function () {
  return (_emscripten_bind_espeak_VOICE_set_score_1 = Module[
    "_emscripten_bind_espeak_VOICE_set_score_1"
  ] =
    Module["asm"]["L"]).apply(null, arguments);
});
var _emscripten_bind_espeak_VOICE_get_spare_0 = (Module[
  "_emscripten_bind_espeak_VOICE_get_spare_0"
] = function () {
  return (_emscripten_bind_espeak_VOICE_get_spare_0 = Module[
    "_emscripten_bind_espeak_VOICE_get_spare_0"
  ] =
    Module["asm"]["M"]).apply(null, arguments);
});
var _emscripten_bind_espeak_VOICE_set_spare_1 = (Module[
  "_emscripten_bind_espeak_VOICE_set_spare_1"
] = function () {
  return (_emscripten_bind_espeak_VOICE_set_spare_1 = Module[
    "_emscripten_bind_espeak_VOICE_set_spare_1"
  ] =
    Module["asm"]["N"]).apply(null, arguments);
});
var _emscripten_bind_espeak_VOICE___destroy___0 = (Module[
  "_emscripten_bind_espeak_VOICE___destroy___0"
] = function () {
  return (_emscripten_bind_espeak_VOICE___destroy___0 = Module[
    "_emscripten_bind_espeak_VOICE___destroy___0"
  ] =
    Module["asm"]["O"]).apply(null, arguments);
});
var _emscripten_bind_espeak_EVENT_get_type_0 = (Module[
  "_emscripten_bind_espeak_EVENT_get_type_0"
] = function () {
  return (_emscripten_bind_espeak_EVENT_get_type_0 = Module[
    "_emscripten_bind_espeak_EVENT_get_type_0"
  ] =
    Module["asm"]["P"]).apply(null, arguments);
});
var _emscripten_bind_espeak_EVENT_get_unique_identifier_0 = (Module[
  "_emscripten_bind_espeak_EVENT_get_unique_identifier_0"
] = function () {
  return (_emscripten_bind_espeak_EVENT_get_unique_identifier_0 = Module[
    "_emscripten_bind_espeak_EVENT_get_unique_identifier_0"
  ] =
    Module["asm"]["Q"]).apply(null, arguments);
});
var _emscripten_bind_espeak_EVENT_get_text_position_0 = (Module[
  "_emscripten_bind_espeak_EVENT_get_text_position_0"
] = function () {
  return (_emscripten_bind_espeak_EVENT_get_text_position_0 = Module[
    "_emscripten_bind_espeak_EVENT_get_text_position_0"
  ] =
    Module["asm"]["R"]).apply(null, arguments);
});
var _emscripten_bind_espeak_EVENT_get_length_0 = (Module[
  "_emscripten_bind_espeak_EVENT_get_length_0"
] = function () {
  return (_emscripten_bind_espeak_EVENT_get_length_0 = Module[
    "_emscripten_bind_espeak_EVENT_get_length_0"
  ] =
    Module["asm"]["S"]).apply(null, arguments);
});
var _emscripten_bind_espeak_EVENT_get_audio_position_0 = (Module[
  "_emscripten_bind_espeak_EVENT_get_audio_position_0"
] = function () {
  return (_emscripten_bind_espeak_EVENT_get_audio_position_0 = Module[
    "_emscripten_bind_espeak_EVENT_get_audio_position_0"
  ] =
    Module["asm"]["T"]).apply(null, arguments);
});
var _emscripten_bind_espeak_EVENT_get_sample_0 = (Module[
  "_emscripten_bind_espeak_EVENT_get_sample_0"
] = function () {
  return (_emscripten_bind_espeak_EVENT_get_sample_0 = Module[
    "_emscripten_bind_espeak_EVENT_get_sample_0"
  ] =
    Module["asm"]["U"]).apply(null, arguments);
});
var _emscripten_bind_espeak_EVENT_get_user_data_0 = (Module[
  "_emscripten_bind_espeak_EVENT_get_user_data_0"
] = function () {
  return (_emscripten_bind_espeak_EVENT_get_user_data_0 = Module[
    "_emscripten_bind_espeak_EVENT_get_user_data_0"
  ] =
    Module["asm"]["V"]).apply(null, arguments);
});
var _emscripten_bind_espeak_EVENT___destroy___0 = (Module[
  "_emscripten_bind_espeak_EVENT___destroy___0"
] = function () {
  return (_emscripten_bind_espeak_EVENT___destroy___0 = Module[
    "_emscripten_bind_espeak_EVENT___destroy___0"
  ] =
    Module["asm"]["W"]).apply(null, arguments);
});
var _emscripten_bind_eSpeakNGWorker_eSpeakNGWorker_0 = (Module[
  "_emscripten_bind_eSpeakNGWorker_eSpeakNGWorker_0"
] = function () {
  return (_emscripten_bind_eSpeakNGWorker_eSpeakNGWorker_0 = Module[
    "_emscripten_bind_eSpeakNGWorker_eSpeakNGWorker_0"
  ] =
    Module["asm"]["X"]).apply(null, arguments);
});
var _emscripten_bind_eSpeakNGWorker_synth__2 = (Module[
  "_emscripten_bind_eSpeakNGWorker_synth__2"
] = function () {
  return (_emscripten_bind_eSpeakNGWorker_synth__2 = Module[
    "_emscripten_bind_eSpeakNGWorker_synth__2"
  ] =
    Module["asm"]["Y"]).apply(null, arguments);
});
var _emscripten_bind_eSpeakNGWorker_synth_ipa__2 = (Module[
  "_emscripten_bind_eSpeakNGWorker_synth_ipa__2"
] = function () {
  return (_emscripten_bind_eSpeakNGWorker_synth_ipa__2 = Module[
    "_emscripten_bind_eSpeakNGWorker_synth_ipa__2"
  ] =
    Module["asm"]["Z"]).apply(null, arguments);
});
var _emscripten_bind_eSpeakNGWorker_getSizeOfEventStruct__0 = (Module[
  "_emscripten_bind_eSpeakNGWorker_getSizeOfEventStruct__0"
] = function () {
  return (_emscripten_bind_eSpeakNGWorker_getSizeOfEventStruct__0 = Module[
    "_emscripten_bind_eSpeakNGWorker_getSizeOfEventStruct__0"
  ] =
    Module["asm"]["_"]).apply(null, arguments);
});
var _emscripten_bind_eSpeakNGWorker_set_voice_2 = (Module[
  "_emscripten_bind_eSpeakNGWorker_set_voice_2"
] = function () {
  return (_emscripten_bind_eSpeakNGWorker_set_voice_2 = Module[
    "_emscripten_bind_eSpeakNGWorker_set_voice_2"
  ] =
    Module["asm"]["$"]).apply(null, arguments);
});
var _emscripten_bind_eSpeakNGWorker_set_voice_3 = (Module[
  "_emscripten_bind_eSpeakNGWorker_set_voice_3"
] = function () {
  return (_emscripten_bind_eSpeakNGWorker_set_voice_3 = Module[
    "_emscripten_bind_eSpeakNGWorker_set_voice_3"
  ] =
    Module["asm"]["aa"]).apply(null, arguments);
});
var _emscripten_bind_eSpeakNGWorker_set_voice_4 = (Module[
  "_emscripten_bind_eSpeakNGWorker_set_voice_4"
] = function () {
  return (_emscripten_bind_eSpeakNGWorker_set_voice_4 = Module[
    "_emscripten_bind_eSpeakNGWorker_set_voice_4"
  ] =
    Module["asm"]["ba"]).apply(null, arguments);
});
var _emscripten_bind_eSpeakNGWorker_set_voice_5 = (Module[
  "_emscripten_bind_eSpeakNGWorker_set_voice_5"
] = function () {
  return (_emscripten_bind_eSpeakNGWorker_set_voice_5 = Module[
    "_emscripten_bind_eSpeakNGWorker_set_voice_5"
  ] =
    Module["asm"]["ca"]).apply(null, arguments);
});
var _emscripten_bind_eSpeakNGWorker_get_voices_1 = (Module[
  "_emscripten_bind_eSpeakNGWorker_get_voices_1"
] = function () {
  return (_emscripten_bind_eSpeakNGWorker_get_voices_1 = Module[
    "_emscripten_bind_eSpeakNGWorker_get_voices_1"
  ] =
    Module["asm"]["da"]).apply(null, arguments);
});
var _emscripten_bind_eSpeakNGWorker_set_voices_2 = (Module[
  "_emscripten_bind_eSpeakNGWorker_set_voices_2"
] = function () {
  return (_emscripten_bind_eSpeakNGWorker_set_voices_2 = Module[
    "_emscripten_bind_eSpeakNGWorker_set_voices_2"
  ] =
    Module["asm"]["ea"]).apply(null, arguments);
});
var _emscripten_bind_eSpeakNGWorker_get_samplerate_0 = (Module[
  "_emscripten_bind_eSpeakNGWorker_get_samplerate_0"
] = function () {
  return (_emscripten_bind_eSpeakNGWorker_get_samplerate_0 = Module[
    "_emscripten_bind_eSpeakNGWorker_get_samplerate_0"
  ] =
    Module["asm"]["fa"]).apply(null, arguments);
});
var _emscripten_bind_eSpeakNGWorker_get_rate_0 = (Module[
  "_emscripten_bind_eSpeakNGWorker_get_rate_0"
] = function () {
  return (_emscripten_bind_eSpeakNGWorker_get_rate_0 = Module[
    "_emscripten_bind_eSpeakNGWorker_get_rate_0"
  ] =
    Module["asm"]["ga"]).apply(null, arguments);
});
var _emscripten_bind_eSpeakNGWorker_set_rate_1 = (Module[
  "_emscripten_bind_eSpeakNGWorker_set_rate_1"
] = function () {
  return (_emscripten_bind_eSpeakNGWorker_set_rate_1 = Module[
    "_emscripten_bind_eSpeakNGWorker_set_rate_1"
  ] =
    Module["asm"]["ha"]).apply(null, arguments);
});
var _emscripten_bind_eSpeakNGWorker_get_pitch_0 = (Module[
  "_emscripten_bind_eSpeakNGWorker_get_pitch_0"
] = function () {
  return (_emscripten_bind_eSpeakNGWorker_get_pitch_0 = Module[
    "_emscripten_bind_eSpeakNGWorker_get_pitch_0"
  ] =
    Module["asm"]["ia"]).apply(null, arguments);
});
var _emscripten_bind_eSpeakNGWorker_set_pitch_1 = (Module[
  "_emscripten_bind_eSpeakNGWorker_set_pitch_1"
] = function () {
  return (_emscripten_bind_eSpeakNGWorker_set_pitch_1 = Module[
    "_emscripten_bind_eSpeakNGWorker_set_pitch_1"
  ] =
    Module["asm"]["ja"]).apply(null, arguments);
});
var _emscripten_bind_eSpeakNGWorker___destroy___0 = (Module[
  "_emscripten_bind_eSpeakNGWorker___destroy___0"
] = function () {
  return (_emscripten_bind_eSpeakNGWorker___destroy___0 = Module[
    "_emscripten_bind_eSpeakNGWorker___destroy___0"
  ] =
    Module["asm"]["ka"]).apply(null, arguments);
});
var _emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_LIST_TERMINATED = (Module[
  "_emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_LIST_TERMINATED"
] = function () {
  return (_emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_LIST_TERMINATED =
    Module["_emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_LIST_TERMINATED"] =
      Module["asm"]["la"]).apply(null, arguments);
});
var _emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_WORD = (Module[
  "_emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_WORD"
] = function () {
  return (_emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_WORD = Module[
    "_emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_WORD"
  ] =
    Module["asm"]["ma"]).apply(null, arguments);
});
var _emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_SENTENCE = (Module[
  "_emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_SENTENCE"
] = function () {
  return (_emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_SENTENCE = Module[
    "_emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_SENTENCE"
  ] =
    Module["asm"]["na"]).apply(null, arguments);
});
var _emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_MARK = (Module[
  "_emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_MARK"
] = function () {
  return (_emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_MARK = Module[
    "_emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_MARK"
  ] =
    Module["asm"]["oa"]).apply(null, arguments);
});
var _emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_PLAY = (Module[
  "_emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_PLAY"
] = function () {
  return (_emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_PLAY = Module[
    "_emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_PLAY"
  ] =
    Module["asm"]["pa"]).apply(null, arguments);
});
var _emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_END = (Module[
  "_emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_END"
] = function () {
  return (_emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_END = Module[
    "_emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_END"
  ] =
    Module["asm"]["qa"]).apply(null, arguments);
});
var _emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_MSG_TERMINATED = (Module[
  "_emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_MSG_TERMINATED"
] = function () {
  return (_emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_MSG_TERMINATED =
    Module["_emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_MSG_TERMINATED"] =
      Module["asm"]["ra"]).apply(null, arguments);
});
var _emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_PHONEME = (Module[
  "_emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_PHONEME"
] = function () {
  return (_emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_PHONEME = Module[
    "_emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_PHONEME"
  ] =
    Module["asm"]["sa"]).apply(null, arguments);
});
var _emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_SAMPLERATE = (Module[
  "_emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_SAMPLERATE"
] = function () {
  return (_emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_SAMPLERATE = Module[
    "_emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_SAMPLERATE"
  ] =
    Module["asm"]["ta"]).apply(null, arguments);
});
var ___errno_location = (Module["___errno_location"] = function () {
  return (___errno_location = Module["___errno_location"] =
    Module["asm"]["va"]).apply(null, arguments);
});
var _free = (Module["_free"] = function () {
  return (_free = Module["_free"] = Module["asm"]["wa"]).apply(null, arguments);
});
var _malloc = (Module["_malloc"] = function () {
  return (_malloc = Module["_malloc"] = Module["asm"]["xa"]).apply(
    null,
    arguments,
  );
});
var ___cxa_is_pointer_type = (Module["___cxa_is_pointer_type"] = function () {
  return (___cxa_is_pointer_type = Module["___cxa_is_pointer_type"] =
    Module["asm"]["ya"]).apply(null, arguments);
});
var ___start_em_js = (Module["___start_em_js"] = 132724);
var ___stop_em_js = (Module["___stop_em_js"] = 132822);
Module["addRunDependency"] = addRunDependency;
Module["removeRunDependency"] = removeRunDependency;
Module["FS_createPath"] = FS.createPath;
Module["FS_createDataFile"] = FS.createDataFile;
Module["FS_createPreloadedFile"] = FS.createPreloadedFile;
Module["FS_createLazyFile"] = FS.createLazyFile;
Module["FS_createDevice"] = FS.createDevice;
Module["FS_unlink"] = FS.unlink;
var calledRun;
dependenciesFulfilled = function runCaller() {
  if (!calledRun) run();
  if (!calledRun) dependenciesFulfilled = runCaller;
};
function run(args) {
  args = args || arguments_;
  if (runDependencies > 0) {
    return;
  }
  preRun();
  if (runDependencies > 0) {
    return;
  }
  function doRun() {
    if (calledRun) return;
    calledRun = true;
    Module["calledRun"] = true;
    if (ABORT) return;
    initRuntime();
    if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
    postRun();
  }
  if (Module["setStatus"]) {
    Module["setStatus"]("Running...");
    setTimeout(function () {
      setTimeout(function () {
        Module["setStatus"]("");
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
}
if (Module["preInit"]) {
  if (typeof Module["preInit"] == "function")
    Module["preInit"] = [Module["preInit"]];
  while (Module["preInit"].length > 0) {
    Module["preInit"].pop()();
  }
}
run();
function WrapperObject() {}
WrapperObject.prototype = Object.create(WrapperObject.prototype);
WrapperObject.prototype.constructor = WrapperObject;
WrapperObject.prototype.__class__ = WrapperObject;
WrapperObject.__cache__ = {};
Module["WrapperObject"] = WrapperObject;
function getCache(__class__) {
  return (__class__ || WrapperObject).__cache__;
}
Module["getCache"] = getCache;
function wrapPointer(ptr, __class__) {
  var cache = getCache(__class__);
  var ret = cache[ptr];
  if (ret) return ret;
  ret = Object.create((__class__ || WrapperObject).prototype);
  ret.ptr = ptr;
  return (cache[ptr] = ret);
}
Module["wrapPointer"] = wrapPointer;
function castObject(obj, __class__) {
  return wrapPointer(obj.ptr, __class__);
}
Module["castObject"] = castObject;
Module["NULL"] = wrapPointer(0);
function destroy(obj) {
  if (!obj["__destroy__"])
    throw "Error: Cannot destroy object. (Did you create it yourself?)";
  obj["__destroy__"]();
  delete getCache(obj.__class__)[obj.ptr];
}
Module["destroy"] = destroy;
function compare(obj1, obj2) {
  return obj1.ptr === obj2.ptr;
}
Module["compare"] = compare;
function getPointer(obj) {
  return obj.ptr;
}
Module["getPointer"] = getPointer;
function getClass(obj) {
  return obj.__class__;
}
Module["getClass"] = getClass;
var ensureCache = {
  buffer: 0,
  size: 0,
  pos: 0,
  temps: [],
  needed: 0,
  prepare: function () {
    if (ensureCache.needed) {
      for (var i = 0; i < ensureCache.temps.length; i++) {
        Module["_free"](ensureCache.temps[i]);
      }
      ensureCache.temps.length = 0;
      Module["_free"](ensureCache.buffer);
      ensureCache.buffer = 0;
      ensureCache.size += ensureCache.needed;
      ensureCache.needed = 0;
    }
    if (!ensureCache.buffer) {
      ensureCache.size += 128;
      ensureCache.buffer = Module["_malloc"](ensureCache.size);
      assert(ensureCache.buffer);
    }
    ensureCache.pos = 0;
  },
  alloc: function (array, view) {
    assert(ensureCache.buffer);
    var bytes = view.BYTES_PER_ELEMENT;
    var len = array.length * bytes;
    len = (len + 7) & -8;
    var ret;
    if (ensureCache.pos + len >= ensureCache.size) {
      assert(len > 0);
      ensureCache.needed += len;
      ret = Module["_malloc"](len);
      ensureCache.temps.push(ret);
    } else {
      ret = ensureCache.buffer + ensureCache.pos;
      ensureCache.pos += len;
    }
    return ret;
  },
  copy: function (array, view, offset) {
    offset >>>= 0;
    var bytes = view.BYTES_PER_ELEMENT;
    switch (bytes) {
      case 2:
        offset >>>= 1;
        break;
      case 4:
        offset >>>= 2;
        break;
      case 8:
        offset >>>= 3;
        break;
    }
    for (var i = 0; i < array.length; i++) {
      view[offset + i] = array[i];
    }
  },
};
function ensureString(value) {
  if (typeof value === "string") {
    var intArray = intArrayFromString(value);
    var offset = ensureCache.alloc(intArray, HEAP8);
    ensureCache.copy(intArray, HEAP8, offset);
    return offset;
  }
  return value;
}
function VoidPtr() {
  throw "cannot construct a VoidPtr, no constructor in IDL";
}
VoidPtr.prototype = Object.create(WrapperObject.prototype);
VoidPtr.prototype.constructor = VoidPtr;
VoidPtr.prototype.__class__ = VoidPtr;
VoidPtr.__cache__ = {};
Module["VoidPtr"] = VoidPtr;
VoidPtr.prototype["__destroy__"] = VoidPtr.prototype.__destroy__ = function () {
  var self = this.ptr;
  _emscripten_bind_VoidPtr___destroy___0(self);
};
function espeak_VOICE() {
  throw "cannot construct a espeak_VOICE, no constructor in IDL";
}
espeak_VOICE.prototype = Object.create(WrapperObject.prototype);
espeak_VOICE.prototype.constructor = espeak_VOICE;
espeak_VOICE.prototype.__class__ = espeak_VOICE;
espeak_VOICE.__cache__ = {};
Module["espeak_VOICE"] = espeak_VOICE;
espeak_VOICE.prototype["get_name"] = espeak_VOICE.prototype.get_name =
  function () {
    var self = this.ptr;
    return UTF8ToString(_emscripten_bind_espeak_VOICE_get_name_0(self));
  };
espeak_VOICE.prototype["set_name"] = espeak_VOICE.prototype.set_name =
  function (arg0) {
    var self = this.ptr;
    ensureCache.prepare();
    if (arg0 && typeof arg0 === "object") arg0 = arg0.ptr;
    else arg0 = ensureString(arg0);
    _emscripten_bind_espeak_VOICE_set_name_1(self, arg0);
  };
Object.defineProperty(espeak_VOICE.prototype, "name", {
  get: espeak_VOICE.prototype.get_name,
  set: espeak_VOICE.prototype.set_name,
});
espeak_VOICE.prototype["get_languages"] = espeak_VOICE.prototype.get_languages =
  function (arg0) {
    var self = this.ptr;
    if (arg0 && typeof arg0 === "object") arg0 = arg0.ptr;
    return _emscripten_bind_espeak_VOICE_get_languages_1(self, arg0);
  };
Object.defineProperty(espeak_VOICE.prototype, "languages", {
  get: espeak_VOICE.prototype.get_languages,
});
espeak_VOICE.prototype["get_identifier"] =
  espeak_VOICE.prototype.get_identifier = function () {
    var self = this.ptr;
    return UTF8ToString(_emscripten_bind_espeak_VOICE_get_identifier_0(self));
  };
espeak_VOICE.prototype["set_identifier"] =
  espeak_VOICE.prototype.set_identifier = function (arg0) {
    var self = this.ptr;
    ensureCache.prepare();
    if (arg0 && typeof arg0 === "object") arg0 = arg0.ptr;
    else arg0 = ensureString(arg0);
    _emscripten_bind_espeak_VOICE_set_identifier_1(self, arg0);
  };
Object.defineProperty(espeak_VOICE.prototype, "identifier", {
  get: espeak_VOICE.prototype.get_identifier,
  set: espeak_VOICE.prototype.set_identifier,
});
espeak_VOICE.prototype["get_gender"] = espeak_VOICE.prototype.get_gender =
  function () {
    var self = this.ptr;
    return _emscripten_bind_espeak_VOICE_get_gender_0(self);
  };
espeak_VOICE.prototype["set_gender"] = espeak_VOICE.prototype.set_gender =
  function (arg0) {
    var self = this.ptr;
    if (arg0 && typeof arg0 === "object") arg0 = arg0.ptr;
    _emscripten_bind_espeak_VOICE_set_gender_1(self, arg0);
  };
Object.defineProperty(espeak_VOICE.prototype, "gender", {
  get: espeak_VOICE.prototype.get_gender,
  set: espeak_VOICE.prototype.set_gender,
});
espeak_VOICE.prototype["get_age"] = espeak_VOICE.prototype.get_age =
  function () {
    var self = this.ptr;
    return _emscripten_bind_espeak_VOICE_get_age_0(self);
  };
espeak_VOICE.prototype["set_age"] = espeak_VOICE.prototype.set_age = function (
  arg0,
) {
  var self = this.ptr;
  if (arg0 && typeof arg0 === "object") arg0 = arg0.ptr;
  _emscripten_bind_espeak_VOICE_set_age_1(self, arg0);
};
Object.defineProperty(espeak_VOICE.prototype, "age", {
  get: espeak_VOICE.prototype.get_age,
  set: espeak_VOICE.prototype.set_age,
});
espeak_VOICE.prototype["get_variant"] = espeak_VOICE.prototype.get_variant =
  function () {
    var self = this.ptr;
    return _emscripten_bind_espeak_VOICE_get_variant_0(self);
  };
espeak_VOICE.prototype["set_variant"] = espeak_VOICE.prototype.set_variant =
  function (arg0) {
    var self = this.ptr;
    if (arg0 && typeof arg0 === "object") arg0 = arg0.ptr;
    _emscripten_bind_espeak_VOICE_set_variant_1(self, arg0);
  };
Object.defineProperty(espeak_VOICE.prototype, "variant", {
  get: espeak_VOICE.prototype.get_variant,
  set: espeak_VOICE.prototype.set_variant,
});
espeak_VOICE.prototype["get_xx1"] = espeak_VOICE.prototype.get_xx1 =
  function () {
    var self = this.ptr;
    return _emscripten_bind_espeak_VOICE_get_xx1_0(self);
  };
espeak_VOICE.prototype["set_xx1"] = espeak_VOICE.prototype.set_xx1 = function (
  arg0,
) {
  var self = this.ptr;
  if (arg0 && typeof arg0 === "object") arg0 = arg0.ptr;
  _emscripten_bind_espeak_VOICE_set_xx1_1(self, arg0);
};
Object.defineProperty(espeak_VOICE.prototype, "xx1", {
  get: espeak_VOICE.prototype.get_xx1,
  set: espeak_VOICE.prototype.set_xx1,
});
espeak_VOICE.prototype["get_score"] = espeak_VOICE.prototype.get_score =
  function () {
    var self = this.ptr;
    return _emscripten_bind_espeak_VOICE_get_score_0(self);
  };
espeak_VOICE.prototype["set_score"] = espeak_VOICE.prototype.set_score =
  function (arg0) {
    var self = this.ptr;
    if (arg0 && typeof arg0 === "object") arg0 = arg0.ptr;
    _emscripten_bind_espeak_VOICE_set_score_1(self, arg0);
  };
Object.defineProperty(espeak_VOICE.prototype, "score", {
  get: espeak_VOICE.prototype.get_score,
  set: espeak_VOICE.prototype.set_score,
});
espeak_VOICE.prototype["get_spare"] = espeak_VOICE.prototype.get_spare =
  function () {
    var self = this.ptr;
    return _emscripten_bind_espeak_VOICE_get_spare_0(self);
  };
espeak_VOICE.prototype["set_spare"] = espeak_VOICE.prototype.set_spare =
  function (arg0) {
    var self = this.ptr;
    if (arg0 && typeof arg0 === "object") arg0 = arg0.ptr;
    _emscripten_bind_espeak_VOICE_set_spare_1(self, arg0);
  };
Object.defineProperty(espeak_VOICE.prototype, "spare", {
  get: espeak_VOICE.prototype.get_spare,
  set: espeak_VOICE.prototype.set_spare,
});
espeak_VOICE.prototype["__destroy__"] = espeak_VOICE.prototype.__destroy__ =
  function () {
    var self = this.ptr;
    _emscripten_bind_espeak_VOICE___destroy___0(self);
  };
function espeak_EVENT() {
  throw "cannot construct a espeak_EVENT, no constructor in IDL";
}
espeak_EVENT.prototype = Object.create(WrapperObject.prototype);
espeak_EVENT.prototype.constructor = espeak_EVENT;
espeak_EVENT.prototype.__class__ = espeak_EVENT;
espeak_EVENT.__cache__ = {};
Module["espeak_EVENT"] = espeak_EVENT;
espeak_EVENT.prototype["get_type"] = espeak_EVENT.prototype.get_type =
  function () {
    var self = this.ptr;
    return _emscripten_bind_espeak_EVENT_get_type_0(self);
  };
Object.defineProperty(espeak_EVENT.prototype, "type", {
  get: espeak_EVENT.prototype.get_type,
});
espeak_EVENT.prototype["get_unique_identifier"] =
  espeak_EVENT.prototype.get_unique_identifier = function () {
    var self = this.ptr;
    return _emscripten_bind_espeak_EVENT_get_unique_identifier_0(self);
  };
Object.defineProperty(espeak_EVENT.prototype, "unique_identifier", {
  get: espeak_EVENT.prototype.get_unique_identifier,
});
espeak_EVENT.prototype["get_text_position"] =
  espeak_EVENT.prototype.get_text_position = function () {
    var self = this.ptr;
    return _emscripten_bind_espeak_EVENT_get_text_position_0(self);
  };
Object.defineProperty(espeak_EVENT.prototype, "text_position", {
  get: espeak_EVENT.prototype.get_text_position,
});
espeak_EVENT.prototype["get_length"] = espeak_EVENT.prototype.get_length =
  function () {
    var self = this.ptr;
    return _emscripten_bind_espeak_EVENT_get_length_0(self);
  };
Object.defineProperty(espeak_EVENT.prototype, "length", {
  get: espeak_EVENT.prototype.get_length,
});
espeak_EVENT.prototype["get_audio_position"] =
  espeak_EVENT.prototype.get_audio_position = function () {
    var self = this.ptr;
    return _emscripten_bind_espeak_EVENT_get_audio_position_0(self);
  };
Object.defineProperty(espeak_EVENT.prototype, "audio_position", {
  get: espeak_EVENT.prototype.get_audio_position,
});
espeak_EVENT.prototype["get_sample"] = espeak_EVENT.prototype.get_sample =
  function () {
    var self = this.ptr;
    return _emscripten_bind_espeak_EVENT_get_sample_0(self);
  };
Object.defineProperty(espeak_EVENT.prototype, "sample", {
  get: espeak_EVENT.prototype.get_sample,
});
espeak_EVENT.prototype["get_user_data"] = espeak_EVENT.prototype.get_user_data =
  function () {
    var self = this.ptr;
    return _emscripten_bind_espeak_EVENT_get_user_data_0(self);
  };
Object.defineProperty(espeak_EVENT.prototype, "user_data", {
  get: espeak_EVENT.prototype.get_user_data,
});
espeak_EVENT.prototype["__destroy__"] = espeak_EVENT.prototype.__destroy__ =
  function () {
    var self = this.ptr;
    _emscripten_bind_espeak_EVENT___destroy___0(self);
  };
function eSpeakNGWorker() {
  this.ptr = _emscripten_bind_eSpeakNGWorker_eSpeakNGWorker_0();
  getCache(eSpeakNGWorker)[this.ptr] = this;
}
eSpeakNGWorker.prototype = Object.create(WrapperObject.prototype);
eSpeakNGWorker.prototype.constructor = eSpeakNGWorker;
eSpeakNGWorker.prototype.__class__ = eSpeakNGWorker;
eSpeakNGWorker.__cache__ = {};
Module["eSpeakNGWorker"] = eSpeakNGWorker;
eSpeakNGWorker.prototype["synth_"] = eSpeakNGWorker.prototype.synth_ =
  function (aText, aCallback) {
    var self = this.ptr;
    ensureCache.prepare();
    if (aText && typeof aText === "object") aText = aText.ptr;
    else aText = ensureString(aText);
    if (aCallback && typeof aCallback === "object") aCallback = aCallback.ptr;
    _emscripten_bind_eSpeakNGWorker_synth__2(self, aText, aCallback);
  };
eSpeakNGWorker.prototype["synth_ipa_"] = eSpeakNGWorker.prototype.synth_ipa_ =
  function (aText, virtualFileName) {
    var self = this.ptr;
    ensureCache.prepare();
    if (aText && typeof aText === "object") aText = aText.ptr;
    else aText = ensureString(aText);
    if (virtualFileName && typeof virtualFileName === "object")
      virtualFileName = virtualFileName.ptr;
    else virtualFileName = ensureString(virtualFileName);
    return _emscripten_bind_eSpeakNGWorker_synth_ipa__2(
      self,
      aText,
      virtualFileName,
    );
  };
eSpeakNGWorker.prototype["getSizeOfEventStruct_"] =
  eSpeakNGWorker.prototype.getSizeOfEventStruct_ = function () {
    var self = this.ptr;
    return _emscripten_bind_eSpeakNGWorker_getSizeOfEventStruct__0(self);
  };
eSpeakNGWorker.prototype["set_voice"] = eSpeakNGWorker.prototype.set_voice =
  function (aName, aLang, gender, age, aVariant) {
    var self = this.ptr;
    ensureCache.prepare();
    if (aName && typeof aName === "object") aName = aName.ptr;
    else aName = ensureString(aName);
    if (aLang && typeof aLang === "object") aLang = aLang.ptr;
    else aLang = ensureString(aLang);
    if (gender && typeof gender === "object") gender = gender.ptr;
    if (age && typeof age === "object") age = age.ptr;
    if (aVariant && typeof aVariant === "object") aVariant = aVariant.ptr;
    if (gender === undefined) {
      return _emscripten_bind_eSpeakNGWorker_set_voice_2(self, aName, aLang);
    }
    if (age === undefined) {
      return _emscripten_bind_eSpeakNGWorker_set_voice_3(
        self,
        aName,
        aLang,
        gender,
      );
    }
    if (aVariant === undefined) {
      return _emscripten_bind_eSpeakNGWorker_set_voice_4(
        self,
        aName,
        aLang,
        gender,
        age,
      );
    }
    return _emscripten_bind_eSpeakNGWorker_set_voice_5(
      self,
      aName,
      aLang,
      gender,
      age,
      aVariant,
    );
  };
eSpeakNGWorker.prototype["get_voices"] = eSpeakNGWorker.prototype.get_voices =
  function (arg0) {
    var self = this.ptr;
    if (arg0 && typeof arg0 === "object") arg0 = arg0.ptr;
    return wrapPointer(
      _emscripten_bind_eSpeakNGWorker_get_voices_1(self, arg0),
      espeak_VOICE,
    );
  };
eSpeakNGWorker.prototype["set_voices"] = eSpeakNGWorker.prototype.set_voices =
  function (arg0, arg1) {
    var self = this.ptr;
    ensureCache.prepare();
    if (arg0 && typeof arg0 === "object") arg0 = arg0.ptr;
    if (arg1 && typeof arg1 === "object") arg1 = arg1.ptr;
    _emscripten_bind_eSpeakNGWorker_set_voices_2(self, arg0, arg1);
  };
Object.defineProperty(eSpeakNGWorker.prototype, "voices", {
  get: eSpeakNGWorker.prototype.get_voices,
  set: eSpeakNGWorker.prototype.set_voices,
});
eSpeakNGWorker.prototype["get_samplerate"] =
  eSpeakNGWorker.prototype.get_samplerate = function () {
    var self = this.ptr;
    return _emscripten_bind_eSpeakNGWorker_get_samplerate_0(self);
  };
Object.defineProperty(eSpeakNGWorker.prototype, "samplerate", {
  get: eSpeakNGWorker.prototype.get_samplerate,
});
eSpeakNGWorker.prototype["get_rate"] = eSpeakNGWorker.prototype.get_rate =
  function () {
    var self = this.ptr;
    return _emscripten_bind_eSpeakNGWorker_get_rate_0(self);
  };
eSpeakNGWorker.prototype["set_rate"] = eSpeakNGWorker.prototype.set_rate =
  function (arg0) {
    var self = this.ptr;
    if (arg0 && typeof arg0 === "object") arg0 = arg0.ptr;
    _emscripten_bind_eSpeakNGWorker_set_rate_1(self, arg0);
  };
Object.defineProperty(eSpeakNGWorker.prototype, "rate", {
  get: eSpeakNGWorker.prototype.get_rate,
  set: eSpeakNGWorker.prototype.set_rate,
});
eSpeakNGWorker.prototype["get_pitch"] = eSpeakNGWorker.prototype.get_pitch =
  function () {
    var self = this.ptr;
    return _emscripten_bind_eSpeakNGWorker_get_pitch_0(self);
  };
eSpeakNGWorker.prototype["set_pitch"] = eSpeakNGWorker.prototype.set_pitch =
  function (arg0) {
    var self = this.ptr;
    if (arg0 && typeof arg0 === "object") arg0 = arg0.ptr;
    _emscripten_bind_eSpeakNGWorker_set_pitch_1(self, arg0);
  };
Object.defineProperty(eSpeakNGWorker.prototype, "pitch", {
  get: eSpeakNGWorker.prototype.get_pitch,
  set: eSpeakNGWorker.prototype.set_pitch,
});
eSpeakNGWorker.prototype["__destroy__"] = eSpeakNGWorker.prototype.__destroy__ =
  function () {
    var self = this.ptr;
    _emscripten_bind_eSpeakNGWorker___destroy___0(self);
  };
(function () {
  function setupEnums() {
    Module["espeakEVENT_LIST_TERMINATED"] =
      _emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_LIST_TERMINATED();
    Module["espeakEVENT_WORD"] =
      _emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_WORD();
    Module["espeakEVENT_SENTENCE"] =
      _emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_SENTENCE();
    Module["espeakEVENT_MARK"] =
      _emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_MARK();
    Module["espeakEVENT_PLAY"] =
      _emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_PLAY();
    Module["espeakEVENT_END"] =
      _emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_END();
    Module["espeakEVENT_MSG_TERMINATED"] =
      _emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_MSG_TERMINATED();
    Module["espeakEVENT_PHONEME"] =
      _emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_PHONEME();
    Module["espeakEVENT_SAMPLERATE"] =
      _emscripten_enum_espeak_EVENT_TYPE_espeakEVENT_SAMPLERATE();
  }
  if (runtimeInitialized) setupEnums();
  else addOnInit(setupEnums);
})();
eSpeakNGWorker.prototype.list_voices = function () {
  var voices = [];
  var i;
  for (
    var voice = this.get_voices((i = 0));
    voice.ptr != 0;
    voice = this.get_voices(++i)
  ) {
    var v = {
      name: voice.get_name(),
      identifier: voice.get_identifier(),
      languages: [],
    };
    var ii = 0;
    var byte = voice.get_languages(ii);
    function nullTerminatedString(offset) {
      var str = "";
      var index = offset;
      var b = voice.get_languages(index++);
      while (b != 0) {
        str += String.fromCharCode(b);
        b = voice.get_languages(index++);
      }
      return str;
    }
    while (byte != 0) {
      var lang = { priority: byte, name: nullTerminatedString(++ii) };
      v.languages.push(lang);
      ii += lang.name.length + 1;
      byte = voice.get_languages(ii);
    }
    voices.push(v);
  }
  return voices;
};
var eventTypes = [
  "list_terminated",
  "word",
  "sentence",
  "mark",
  "play",
  "end",
  "msg_terminated",
  "phoneme",
  "samplerate",
];
eSpeakNGWorker.prototype.synthesize = function (aText, aCallback) {
  var eventStructSize = this.getSizeOfEventStruct_();
  function cb(ptr, length, events_pointer) {
    var data = new Float32Array(length * 2);
    for (var i = 0; i < length; i++) {
      data[i * 2] = Math.max(
        -1,
        Math.min(1, getValue(ptr + i * 2, "i16") / 32768),
      );
      data[i * 2 + 1] = data[i * 2];
    }
    var events = [];
    var ptr = events_pointer;
    for (
      ev = wrapPointer(ptr, espeak_EVENT);
      ev.get_type() != Module.espeakEVENT_LIST_TERMINATED;
      ev = wrapPointer((ptr += eventStructSize), espeak_EVENT)
    ) {
      events.push({
        type: eventTypes[ev.get_type()],
        text_position: ev.get_text_position(),
        word_length: ev.get_length(),
        audio_position: ev.get_audio_position(),
      });
    }
    return aCallback(data, events) ? 1 : 0;
  }
  var fp = addFunction(cb);
  this.synth_(aText, fp);
  removeFunction(fp);
};
eSpeakNGWorker.prototype.synthesize_ipa = function (aText, aCallback) {
  var ipaVirtualFileName =
    "espeak-ng-ipa-tmp-" + Math.random().toString().substring(2);
  var res = "";
  var code = this.synth_ipa_(aText, ipaVirtualFileName);
  if (code == 0) res = FS.readFile(ipaVirtualFileName, { encoding: "utf8" });
  FS.unlink(ipaVirtualFileName);
  var ret = { code: code, ipa: res };
  return ret;
};
if (typeof WorkerGlobalScope !== "undefined") {
  var worker;
  Module.postRun = Module.postRun || [];
  Module.postRun.push(function () {
    worker = new eSpeakNGWorker();
    postMessage("ready");
  });
  onmessage = function (e) {
    if (!worker) {
      throw "eSpeakNGWorker worker not initialized";
    }
    var args = e.data.args;
    var message = { callback: e.data.callback, done: true };
    if (e.data.method == "synthesize") {
      args.push(function (samples, events) {
        postMessage(
          { callback: e.data.callback, result: [samples.buffer, events] },
          [samples.buffer],
        );
      });
    }
    message.result = [worker[e.data.method].apply(worker, args)];
    if (e.data.callback) postMessage(message);
  };
}

module.exports = Module;
