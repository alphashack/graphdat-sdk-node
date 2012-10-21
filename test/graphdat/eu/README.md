End User tests
==============

This test suite makes web requests to test applications in order to test for accurate instrumentation readings.  To improve authenticity of the tests each test is represented by a separate source file that is launched with its own node process.  Tests are located in the tests folder and are executed in order.  Each test consists of two files:


*  __testname.server.js__ - The end user application with instrumentation as it would be used in the wild
*  __testname.scenario.json__ - A description of what requests to make to the server and what the expected instrumentation readings should be received.

The scenario file should follow the following sample format:  



    {
        requests : [
            { path:'/test' }
        ]

        expect : {
        }
    }


To validate that accurate data is recorded by the instrumentation the harness impersonates the graphdat-agent socket endpoint and intercepts outbound measures.

##To run tests

__Step 1__ - Stop the graphdat agent if it is running  


    sudo /etc/init.d/graphdat stop


__Step 2__ - Start the test harness


    node harness.js


