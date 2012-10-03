Graphdat SDK
============

This is a Node package forked from "nodetime". It works on linux (and the like) and OSX.

###Installation
Add our nodetime dependency to your package.json:

    "graphdat": "git://github.com/alphashack/graphdat-sdk-node.git"

Install the package:

    npm install
Before any other require statements in your app, require nodetime:

    require('nodetime').profile({
        netSync: false,
        gdSync: {}
    });


###Configuration
Configuration information can be passed to the library via the gdSync property in the call to profile. 
The presence of the gdSync property enables sending data to the agent, to disable either remove the property, set it to false, or remove the nodetime require altogether.



Options supported:
Name    Default Meaning
socketFile
/tmp/gd.agent.sock  The file descriptor to use for communications between the library and the agent


E.g.:
    require('nodetime').profile({
        netSync: false,
        gdSync: {
            socketFile: "/tmp/testing.sock"
        }
    });


###Logging
The library will log errors to the console.



###Uninstallation
Remove the require('graphdat') line from your .js file

Remove the nodetime depecndency from your package.json

Delete the nodetime directory in your node_modules directory

## License

Copyright (c) 2012 Dmitri Melikyan

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

