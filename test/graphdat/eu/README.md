End User tests
==============

This test suite makes web requests to server.js in order to test for accurate instrumentation readings.  The server.js file represents a series of instrumentation scenarios that we expect most end-users to use in their applications.  This file should not contain anything other than what a typical user require.  To validate that accurate data is recorded by the instrumentation this client impersonates the graphdat-agent socket endpoint and intercepts outbound measures.

To run tests -

1.  Stop the graphdat agent if it is running


    sudo /etc/init.d/graphdat stop
    
2.  Start the server.js


    node server.js

3.  Start the client.js


    node client.js


