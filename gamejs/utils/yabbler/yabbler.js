 /*
  * Copyright (c) 2010 James Brantly
  * 
  * Permission is hereby granted, free of charge, to any person
  * obtaining a copy of this software and associated documentation
  * files (the "Software"), to deal in the Software without
  * restriction, including without limitation the rights to use,
  * copy, modify, merge, publish, distribute, sublicense, and/or sell
  * copies of the Software, and to permit persons to whom the
  * Software is furnished to do so, subject to the following
  * conditions:
  *
  * The above copyright notice and this permission notice shall be
  * included in all copies or substantial portions of the Software.
  *
  * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
  * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
  * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
  * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
  * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
  * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
  * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
  * OTHER DEALINGS IN THE SOFTWARE.
  */

function createWrappedFile(inFileObj, outFileObj, referencePath) {
	var moduleName = new String(inFileObj.getName());
	moduleName = moduleName.substring(0, moduleName.length-3);
	
	var moduleId = resolveModuleId('./'+moduleName, referencePath)
	var moduleCode = readFile(inFileObj);
	var deps = determineShallowDependencies(moduleCode);
	deps = deps.map(function(dep) {
		return '"' + resolveModuleId(dep, referencePath) +'"';
	});

	var newModuleCode = '/* This file has been generated by yabbler.js */';
	newModuleCode += '\r\nrequire.define({';
	newModuleCode += '\r\n"' + moduleId + '": function(require, exports, module) {';
	newModuleCode += '\r\n'+moduleCode;
	newModuleCode += '\r\n}}, [' + deps.join(', ') + ']);';
	
	writeFile(outFileObj, newModuleCode);
};

function determineShallowDependencies(moduleCode) {
	// need to account for comments
	var deps = {}, match, unique = {};
	
	var requireRegex = /(?:^|[^\w\$_.])require\s*\(\s*("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')\s*\)/g;
	while (match = requireRegex.exec(moduleCode)) {
		var module = eval(match[1]);
		if (!Object.prototype.hasOwnProperty.call(deps, module)) {
			deps[module] = true;
		}
	}
	
	var ensureRegex = /(?:^|[^\w\$_.])require.ensure\s*\(\s*(\[("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'|\s*|,)*\])/g;
	while (match = ensureRegex.exec(moduleCode)) {
		var moduleArray = eval(match[1]);
		for (var i = moduleArray.length; i--;) {
			var module = moduleArray[i];
			delete deps[module];
		}
	}
	
	var depsArray = [];
	for (var module in deps) {
		if (Object.prototype.hasOwnProperty.call(deps, module)) {
			depsArray.push(module);
		}
	}
	
	return depsArray;
};

function resolveModuleId(path, referencePath) {
	if (path[0] != '.') {
		return path;
	}
	else {
		var pathParts = path.split('/');
		referencePath = referencePath || '';
		if (referencePath.length && referencePath[referencePath.length-1] != '/') {
			referencePath += '/';
		}
		var referencePathParts = referencePath.split('/');
		referencePathParts.pop();
		var part;
		while (part = pathParts.shift()) {
			if (part == '.') { continue; }
			else if (part == '..' 
				&& referencePathParts.length 
				&& referencePathParts[referencePathParts.length-1] != '..') { referencePathParts.pop(); }
			else { referencePathParts.push(part); }
		}
		return referencePathParts.join('/');
	}
};

function readFile(fileObj) {
	var encoding = 'UTF-8'; 
	var result = null;
	try {
		var inStream = new java.io.InputStreamReader(new java.io.FileInputStream(fileObj), encoding);
		var writer = new java.io.StringWriter();
		
		var n,
			buffer = java.lang.reflect.Array.newInstance(java.lang.Character.TYPE, 4096);

		while ((n = inStream.read(buffer, 0, buffer.length)) != -1) {
			writer.write(buffer, 0, n);
		}
		
		result = new String(writer.toString());
	}
	finally {
		if (inStream) {
			inStream.close();
		}
	}

	return result;
};

function writeFile(fileObj, contents) {
	var encoding = 'UTF-8';
	try {
		fileObj.getParentFile().mkdirs();
		var outStream = new java.io.OutputStreamWriter(new java.io.FileOutputStream(fileObj), encoding);
		outStream.write(contents);
	}
	finally {
		if (outStream) {
			outStream.close();
		}
	}
};

function processDirectory(inFileObj, outFileObj, referencePath) {
	var jsFilter = new java.io.FileFilter() {
		accept: function(fileObj) {
			return fileObj.isFile() && fileObj.getName().endsWith('.js');
		}
	};

	var jsFiles = inFileObj.listFiles(jsFilter);

	jsFiles.forEach(function(jsFile) {
		createWrappedFile(jsFile, new java.io.File(outFileObj, jsFile.getName()), referencePath);
	});
	
	var dirFilter = new java.io.FileFilter() {
		accept: function(fileObj) {
			return fileObj.isDirectory();
		}
	};
	
	var subDirs = inFileObj.listFiles(dirFilter);
	
	subDirs.forEach(function(subDir) {
		processDirectory(subDir, new java.io.File(outFileObj, subDir.getName()), new String(referencePath+subDir.getName()+'/'));
	});
};

var inputDir = 'source';
var outputDir = 'build';

for (var i = 0, n = arguments.length; i<n; i++) {
	var arg = arguments[i];
	if (arg == '-i') {
		i++;
		inputDir = arguments[i]; 
	}
	else if (arg == '-o') {
		i++;
		outputDir = arguments[i];
	}
}

processDirectory(new java.io.File(inputDir), new java.io.File(outputDir), '');
