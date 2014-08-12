from google.appengine.api import users

import logging
import webapp2
import base64
from Crypto.Cipher import AES

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
            greeting = ('<a href="%s">Sign in or register</a>.' %
                        users.create_login_url('/'))

            self.response.out.write('<html><body>%s</body></html>' % greeting)

application = webapp2.WSGIApplication([
    ('/', MainPage),
], debug=True)
