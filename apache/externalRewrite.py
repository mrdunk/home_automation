#!/usr/bin/python -u
# Calling python with "-u" gives unbufferd stdin and stdout.

import sys
import base64
from Crypto.Cipher import AES
import datetime

AUTHERISED_USERS = ['mrdunk', 'jessica.whelan']
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


if __name__ == "__main__":
  while True:
    # grab line from stdin and sanitize it
    line = sys.stdin.readline().strip().strip('#')

    # If we have been passed a Content-Type header, get the X-Key from it.
    # eg: "text/plain;charset=UTF-8,X-Key=#F30D79FB03749C93E090F8D1E7865EB7,testKey=testVal"
    if 'X-Key=' in line:
      line = line.partition('X-Key=')[2]
      line = line.split(',')[0].strip().strip('#')

    decrypted = "none"
    result = 0

    if not line:
      line = '*Empty key*'
      decrypted = 'NA'
    else:
      try:
        decrypted = decrypt(line)
	if [s for s in AUTHERISED_USERS if decrypted.strip() == s.strip()]:
          result = 1
      except TypeError:
        decrypted = "Authentication error: bad key"
      except ValueError:
        decrypted = "Authentication error: bad key"
      except Exception as e:
        decrypted = "Authentication error: %s" % str(e)

    fo = open("/tmp/debug_externalRewrite.txt", "a")
    fo.write('%s\t%s\t%s\t%s\n' % (datetime.datetime.now(), result, line, decrypted))
    fo.close()
    print result
