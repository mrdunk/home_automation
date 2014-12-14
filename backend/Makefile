CC=g++
CFLAGS=-Wall -std=c++11
GTEST_DIR=./gtest-1.7.0/
GMOCK_DIR=./gmock-1.7.0/

all: homeautod

homeautod: main.o httpServer.o json.o cyclicStore.o wsServer.o auth.o base64.o
	$(CC) main.o httpServer.o json.o cyclicStore.o wsServer.o auth.o base64.o -lmicrohttpd -I./ -lboost_system -lboost_thread -lcryptopp -o homeautod

main.o: main.cpp
	$(CC) -c $(CFLAGS) -I./ main.cpp

httpServer.o: httpServer.cpp
	$(CC) -c $(CFLAGS) httpServer.cpp

json.o: json.cpp
	$(CC) -c $(CFLAGS) json.cpp

cyclicStore.o: cyclicStore.cpp
	$(CC) -c $(CFLAGS) cyclicStore.cpp

wsServer.o: wsServer.cpp
	$(CC) -c $(CFLAGS) -I./ wsServer.cpp

auth.o: auth.cpp
	$(CC) -c $(CFLAGS) auth.cpp

base64.o: base64.cpp
	$(CC) -c $(CFLAGS) base64.cpp

gtest-all.o:
	$(CC) -isystem ${GTEST_DIR}/include -I${GTEST_DIR} -pthread -c ${GTEST_DIR}/src/gtest-all.cc
	ar -rv libgtest.a gtest-all.o

test: gtest-all.o gmock-all.o
	$(CC) $(CFLAGS) -Og -isystem ${GTEST_DIR}/include -isystem ${GMOCK_DIR}/include -pthread tests/cyclicStore_test.cpp cyclicStore.cpp \
		${GTEST_DIR}/src/gtest_main.cc libgtest.a libgmock.a -o tests/cyclicStore_test

gmock-all.o:
	$(CC) $(CFLAGS) -isystem ${GTEST_DIR}/include -I${GTEST_DIR} -isystem ${GMOCK_DIR}/include -I${GMOCK_DIR} -pthread -c ${GTEST_DIR}/src/gtest-all.cc
	$(CC) $(CFLAGS) -isystem ${GTEST_DIR}/include -I${GTEST_DIR} -isystem ${GMOCK_DIR}/include -I${GMOCK_DIR} -pthread -c ${GMOCK_DIR}/src/gmock-all.cc
	ar -rv libgmock.a gtest-all.o gmock-all.o

clean:
	rm -rf *o homeautod
	rm -rf tests/*o tests/cyclicStore_test

#	g++ -std=c++11 -Wall ./main.cpp ./httpServer.cpp ./json.cpp ./cyclicStore.cpp ./wsServer.cpp -l microhttpd -I./ -lboost_system -lboost_thread
