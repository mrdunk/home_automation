# mkdir lib
# pip install -t lib google-api-python-client

A copy of the web-client "client_secrets.json" can be downloaded here:
 https://console.cloud.google.com/apis/credentials?project=home-automation-7


To run loacal instance:
 duncan@stumpy:~/Working/home_automation/auth_app$ ../../google-cloud-sdk/platform/google_appengine/dev_appserver.py --host 192.168.192.254 --port 8888 --admin_host 192.168.192.254 ./

To upload to GAE:
 duncan@stumpy:~/Working/home_automation/auth_app$ ../../google-cloud-sdk/platform/google_appengine/appcfg.py --oauth2 --noauth_local_webserver update ./

