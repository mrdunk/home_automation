CC=g++
CFLAGS=-c -Wall -std=c++11

all: homeautod

homeautod: main.o httpServer.o json.o cyclicStore.o wsServer.o
	$(CC) main.o httpServer.o json.o cyclicStore.o wsServer.o -lmicrohttpd -I./ -lboost_system -lboost_thread -o homeautod

main.o: main.cpp
	$(CC) $(CFLAGS) -I./ main.cpp

httpServer.o: httpServer.cpp
	$(CC) $(CFLAGS) httpServer.cpp

json.o: json.cpp
	$(CC) $(CFLAGS) json.cpp

cyclicStore.o: cyclicStore.cpp
	$(CC) $(CFLAGS) cyclicStore.cpp

wsServer.o: wsServer.cpp
	$(CC) $(CFLAGS) -I./ wsServer.cpp

clean:
	rm -rf *o homeautod

#	g++ -std=c++11 -Wall ./main.cpp ./httpServer.cpp ./json.cpp ./cyclicStore.cpp ./wsServer.cpp -l microhttpd -I./ -lboost_system -lboost_thread
