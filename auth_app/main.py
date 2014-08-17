from oauth2client.appengine import OAuth2DecoratorFromClientSecrets
from oauth2client.client import flow_from_clientsecrets

from apiclient.discovery import build
from google.appengine.api import users

import logging
import os
import webapp2
import base64
from Crypto.Cipher import AES

scope=[#'https://www.googleapis.com/auth/plus.login',
	'https://www.googleapis.com/auth/plus.me',
	'https://www.googleapis.com/auth/userinfo.email',
	'https://www.googleapis.com/auth/userinfo.profile']

decorator = OAuth2DecoratorFromClientSecrets(
  os.path.join(os.path.dirname(__file__), 'client_secrets.json'),
  scope=scope)


KEY = 'donkeyarsemonkeydynamyte'

""" https://pypi.python.org/pypi/pycrypto/2.0.1 """
def encrypt(message):
    # Pad message so it is a multiple of 16 bytes long.
    message = message + ' ' * (16 - len(message) % 16)

    obj=AES.new(KEY, AES.MODE_ECB)
    ciphertext = obj.encrypt(message)

    # Convert binary into something we can pass in a URL.    
    ciphertext = base64.b16encode(ciphertext)

    #logging.info(ciphertext)
    return ciphertext

def decrypt(ciphertext):
    ciphertext = base64.b16decode(ciphertext)
    obj2 = AES.new(KEY, AES.MODE_ECB)
    message = obj2.decrypt(ciphertext)

    return message


class MainPage(webapp2.RequestHandler):
    def get(self):
        user = users.get_current_user()
	if user:
		self.redirect('/dial/index.html#' + encrypt(user.nickname()))
	else:
		self.redirect('/dial/index.html')

class AuthKey(webapp2.RequestHandler):
    @decorator.oauth_aware
    def get(self):
        if users.get_current_user():  #decorator.has_credentials():
	    user = users.get_current_user()
	    response = '{"loginStatus": true, "key": "' + encrypt(user.nickname()) + '", "url": "' + users.create_logout_url('/') + '"}'

	    self.response.headers['Content-Type'] = 'application/json'
            self.response.out.write(response)
        else:
	    response = "{u'loginStatus': false, u'url': u'/logIn/'}"
	    #response = "{u'loginStatus': false}"
	    self.response.headers['Content-Type'] = 'application/json'
            self.response.out.write(response)

class LogIn(webapp2.RequestHandler):
    @decorator.oauth_required
    def get(self):
	#response = "{u'loginStatus': " + str(decorator.has_credentials()) + "}"
	#self.response.headers['Content-Type'] = 'application/json'
        #self.response.out.write(response)
	self.redirect('/dial/index.html')

service = build('plus', 'v1')
class Who(webapp2.RequestHandler):
    #@decorator.oauth_required
    @decorator.oauth_aware
    def get(self):
	if users.get_current_user():   # decorator.has_credentials():
	    http = decorator.http()

	    logging.info(decorator.get_flow())
	    logging.info(decorator.get_credentials().to_json())

    	    # Call the service using the authorized Http object.a
	    data = service.people()
            #response = data.get(userId='me').execute(http=http)
	    response = data.get(userId='me',fields='displayName,image').execute(http=http)
	    self.response.headers['Content-Type'] = 'application/json'
	    self.response.out.write(response)
	else:
	    #response = "{u'loginStatus': false, u'url': u'" + decorator.authorize_url() + "'}"
	    response = "{u'loginStatus': false, u'url': u'/logIn/'}"
            self.response.headers['Content-Type'] = 'application/json'
            self.response.out.write(response)



application = webapp2.WSGIApplication([
    ('/', MainPage),
    ('/authKey/', AuthKey),
    ('/logIn/', LogIn),
    ('/who/', Who),
    (decorator.callback_path, decorator.callback_handler()),
], debug=True)
