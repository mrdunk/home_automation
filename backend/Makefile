CC=g++
CFLAGS=-Wall -std=c++11
GTEST_DIR=./tests/googletest-master/googletest/
GMOCK_DIR=./tests/googletest-master/googlemock/

all: homeautod

homeautod: main.o httpServer.o json.o cyclicStore.o fileUtils.o wsServer.o auth.o base64.o
	$(CC) main.o httpServer.o json.o cyclicStore.o fileUtils.o wsServer.o auth.o base64.o -lmicrohttpd -I./ -I ./websocketpp/ -lboost_system -lboost_thread -lcryptopp -lcurl -o homeautod

main.o: main.cpp
	$(CC) -c $(CFLAGS) -I./ main.cpp

httpServer.o: httpServer.cpp
	$(CC) -c $(CFLAGS) httpServer.cpp

json.o: json.cpp
	$(CC) -c $(CFLAGS) json.cpp

cyclicStore.o: cyclicStore.cpp
	$(CC) -c $(CFLAGS) cyclicStore.cpp

fileUtils.o: fileUtils.cpp
	$(CC) -c $(CFLAGS) fileUtils.cpp

wsServer.o: wsServer.cpp
	$(CC) -c $(CFLAGS) -I./ wsServer.cpp

auth.o: auth.cpp
	$(CC) -c $(CFLAGS) auth.cpp

base64.o: base64.cpp
	$(CC) -c $(CFLAGS) base64.cpp

gtest-all.o:
	$(CC) -isystem ${GTEST_DIR}/include -I${GTEST_DIR} -pthread -c ${GTEST_DIR}/src/gtest-all.cc
	ar -rv libgtest.a gtest-all.o

test: gtest-all.o gmock-all.o fileUtils.o
	$(CC) $(CFLAGS) -Og -isystem ${GTEST_DIR}/include -isystem ${GMOCK_DIR}/include -pthread tests/cyclicStore_test.cpp cyclicStore.cpp \
		${GTEST_DIR}/src/gtest_main.cc libgtest.a libgmock.a fileUtils.o -o tests/cyclicStore_test 

gmock-all.o:
	$(CC) $(CFLAGS) -isystem ${GTEST_DIR}/include -I${GTEST_DIR} -isystem ${GMOCK_DIR}/include -I${GMOCK_DIR} -pthread -c ${GTEST_DIR}/src/gtest-all.cc
	$(CC) $(CFLAGS) -isystem ${GTEST_DIR}/include -I${GTEST_DIR} -isystem ${GMOCK_DIR}/include -I${GMOCK_DIR} -pthread -c ${GMOCK_DIR}/src/gmock-all.cc
	ar -rv libgmock.a gtest-all.o gmock-all.o

clean:
	rm -rf *.a
	rm -rf *.o homeautod
	rm -rf tests/*.o tests/cyclicStore_test

#	g++ -std=c++11 -Wall ./main.cpp ./httpServer.cpp ./json.cpp ./cyclicStore.cpp ./wsServer.cpp -l microhttpd -I./ -lboost_system -lboost_thread
