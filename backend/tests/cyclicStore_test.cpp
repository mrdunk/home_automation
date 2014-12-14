#include "../cyclicStore.h"
#include "gmock/gmock.h"
#include "gtest/gtest.h"

using ::testing::AtLeast;
using ::testing::_;
using ::testing::Return;
using ::testing::SetArgPointee;
using ::testing::DoAll;
using ::testing::SetArrayArgument;
using ::testing::InSequence;
using ::testing::MatchesRegex;

class MockStatWrapper : public StatWrapperInterface {
    public:
        MOCK_METHOD2(_stat, int(const char *path, struct stat *p_buf));
};

class MockOFstreamWrapper : public OFstreamWrapper {
    public:
        MOCK_METHOD2(ofStreamOpen, void(const char* filename, ios_base::openmode mode));
        MOCK_METHOD1(ofStreamWrite, void(const string data_to_write));
        MOCK_METHOD0(ofStreamClose, void());
};

class MockIFstreamWrapper : public IFstreamWrapper {
    public:
        MOCK_METHOD1(ifStreamOpen, void(const char* filename));
        MOCK_METHOD0(ifStreamClose, void());
        MOCK_METHOD0(ifStreamIsOpen, bool());
        MOCK_METHOD2(ifStreamGetline, void(char* s, streamsize n));
};

class MockFileUtils : public FileUtils {
    public:
        MockFileUtils(StatWrapperInterface* p_statWrapper,
                      OFstreamWrapper* p_ofStreamWrapper,
                      IFstreamWrapper* p_ifStreamWrapper) :
            FileUtils(p_statWrapper, p_ofStreamWrapper, p_ifStreamWrapper){};

        MOCK_METHOD3(write, void(const string path, const string filename, string data_to_write));
        MOCK_METHOD2(_rename, void(const string oldFilename, const string newFilename));
        MOCK_METHOD3(readLine, void(const string path, const string filename, string* data));
};

//TEST(FileUtilsTest, DefaultConstructor){
//    MockFileUtilsStat instance;
//}

const string path = "/test/path";
const string filename = "testFilename";
const string filename2 = "testFilename2";
string data = "some things and stuff.";

TEST(FileUtilsTest, writable){
    // TODO Test file_mutex.lock().

    struct stat buf_fail;   // Contents of buffer modified by stat() indicate path missing.
    buf_fail.st_mode = 0;
    struct stat buf_pass;   // Contents of buffer modified by stat() indicate path exists.
    buf_pass.st_mode = S_IFDIR;

    MockStatWrapper mockStatInstance;
    MockOFstreamWrapper mockOFstreamInstance;
    MockIFstreamWrapper mockIFstreamInstance;
    FileUtils fileUtilsInstance(&mockStatInstance, &mockOFstreamInstance, &mockIFstreamInstance);

    EXPECT_CALL(mockStatInstance, _stat(_,_))
        .Times(AtLeast(1))
        .WillOnce(DoAll(SetArgPointee<1>(buf_pass), Return(-1)))
        .WillOnce(DoAll(SetArgPointee<1>(buf_fail), Return(1)))
        .WillOnce(DoAll(SetArgPointee<1>(buf_pass), Return(1)));

    EXPECT_EQ(-1, fileUtilsInstance.writable(path, filename));
    EXPECT_EQ(-1, fileUtilsInstance.writable(path, filename));
    EXPECT_EQ(1, fileUtilsInstance.writable(path, filename));

};


TEST(FileUtilsTest, writeSucess){
    struct stat buf_pass;   // Contents of buffer modified by stat() indicate path exists.
    buf_pass.st_mode = S_IFDIR;

    MockStatWrapper mockStatInstance;
    MockOFstreamWrapper mockOFstreamInstance;
    MockIFstreamWrapper mockIFstreamInstance;
    FileUtils fileUtilsInstance(&mockStatInstance, &mockOFstreamInstance, &mockIFstreamInstance);

    EXPECT_CALL(mockStatInstance, _stat(_,_))
        .Times(AtLeast(1))
        .WillOnce(DoAll(SetArgPointee<1>(buf_pass), Return(1)));

    EXPECT_CALL(mockOFstreamInstance, ofStreamOpen(_,_))
        .Times(AtLeast(1));

    EXPECT_CALL(mockOFstreamInstance, ofStreamWrite(_))
        .Times(AtLeast(1));

    EXPECT_CALL(mockOFstreamInstance, ofStreamClose())
        .Times(AtLeast(1));

    fileUtilsInstance.write(path, filename, data);
};

TEST(FileUtilsTest, writeBadPath){
    struct stat buf_fail;   // Contents of buffer modified by stat() indicate path missing.
    buf_fail.st_mode = 0;

    MockStatWrapper mockStatInstance;
    MockOFstreamWrapper mockOFstreamInstance;
    MockIFstreamWrapper mockIFstreamInstance;
    FileUtils fileUtilsInstance(&mockStatInstance, &mockOFstreamInstance, &mockIFstreamInstance);

    EXPECT_CALL(mockStatInstance, _stat(_,_))
        .Times(AtLeast(1))
        .WillOnce(DoAll(SetArgPointee<1>(buf_fail), Return(1)));

    EXPECT_CALL(mockOFstreamInstance, ofStreamOpen(_,_))
        .Times(0);

    EXPECT_CALL(mockOFstreamInstance, ofStreamWrite(_))
        .Times(0);

    EXPECT_CALL(mockOFstreamInstance, ofStreamClose())
        .Times(0);

    fileUtilsInstance.write(path, filename, data);
};

TEST(FileUtilsTest, readSucces){
    struct stat buf_pass;   // Contents of buffer modified by stat() indicate path missing.
    buf_pass.st_mode = S_IFDIR;

    const char outputData1[] = "test data";
    const char outputData2[] = "";

    MockStatWrapper mockStatInstance;
    MockOFstreamWrapper mockOFstreamInstance;
    MockIFstreamWrapper mockIFstreamInstance;
    FileUtils fileUtilsInstance(&mockStatInstance, &mockOFstreamInstance, &mockIFstreamInstance);

    EXPECT_CALL(mockStatInstance, _stat(_,_))
        .WillRepeatedly(DoAll(SetArgPointee<1>(buf_pass), Return(1)));

    EXPECT_CALL(mockIFstreamInstance, ifStreamIsOpen())
        .Times(AtLeast(1))
        .WillOnce(Return(false))
        .WillRepeatedly(Return(true));

    InSequence s;
    EXPECT_CALL(mockIFstreamInstance, ifStreamOpen(_))
        .Times(AtLeast(1));

    EXPECT_CALL(mockIFstreamInstance, ifStreamGetline(_,_))
            .Times(AtLeast(2))
            .WillOnce(SetArrayArgument<0>(outputData1, outputData1 + strlen(outputData1) +1))
            .WillOnce(SetArrayArgument<0>(outputData2, outputData2 + strlen(outputData2) +1));

    EXPECT_CALL(mockIFstreamInstance, ifStreamClose())
                .Times(AtLeast(0));

    string receivedData;
    fileUtilsInstance.readLine(path, filename, &receivedData);
    ASSERT_STREQ(outputData1, receivedData.c_str());
    fileUtilsInstance.readLine(path, filename, &receivedData);
    ASSERT_STREQ(outputData2, receivedData.c_str());
};

TEST(FileUtilsTest, readMultipleSucces){
    struct stat buf_pass;   // Contents of buffer modified by stat() indicate path missing.
    buf_pass.st_mode = S_IFDIR;

    const char outputData1[] = "test data";
    const char outputData2[] = "";

    MockStatWrapper mockStatInstance;
    MockOFstreamWrapper mockOFstreamInstance;
    MockIFstreamWrapper mockIFstreamInstance;
    FileUtils fileUtilsInstance(&mockStatInstance, &mockOFstreamInstance, &mockIFstreamInstance);

    EXPECT_CALL(mockStatInstance, _stat(_,_))
        .WillRepeatedly(DoAll(SetArgPointee<1>(buf_pass), Return(1)));

    EXPECT_CALL(mockIFstreamInstance, ifStreamIsOpen())
        .Times(AtLeast(1))
        .WillOnce(Return(true))
        .WillOnce(Return(true))
        .WillRepeatedly(Return(false));

    EXPECT_CALL(mockIFstreamInstance, ifStreamOpen(_))
        .Times(AtLeast(1));

    EXPECT_CALL(mockIFstreamInstance, ifStreamGetline(_,_))
            .Times(AtLeast(4))
            .WillOnce(SetArrayArgument<0>(outputData1, outputData1 + strlen(outputData1) +1))
            .WillOnce(SetArrayArgument<0>(outputData1, outputData1 + strlen(outputData1) +1))
            .WillOnce(SetArrayArgument<0>(outputData2, outputData2 + strlen(outputData2) +1))
            .WillOnce(SetArrayArgument<0>(outputData2, outputData2 + strlen(outputData2) +1));

    EXPECT_CALL(mockIFstreamInstance, ifStreamClose())
                .Times(AtLeast(1));

    string receivedData;
    fileUtilsInstance.readLine(path, filename, &receivedData);
    ASSERT_STREQ(outputData1, receivedData.c_str());
    fileUtilsInstance.readLine(path, filename2, &receivedData);
    ASSERT_STREQ(outputData1, receivedData.c_str());
    fileUtilsInstance.readLine(path, filename, &receivedData);
    ASSERT_STREQ(outputData2, receivedData.c_str());
    fileUtilsInstance.readLine(path, filename2, &receivedData);
    ASSERT_STREQ(outputData2, receivedData.c_str());
};

TEST(CyclicTest, constructor){

    MockStatWrapper mockStatInstance;
    MockOFstreamWrapper mockOFstreamInstance;
    MockIFstreamWrapper mockIFstreamInstance;
    MockFileUtils mockFileUtilsInstance(&mockStatInstance, &mockOFstreamInstance, &mockIFstreamInstance);

    ASSERT_EQ(Cyclic::allCyclic.size(), 0);    
    Cyclic test1("test1", 6, 60, 100, 0, "/test/path/", &mockFileUtilsInstance);
    Cyclic test2("test2", 10, MINS_IN_WEEK, 100, 0, "/test/path/", &mockFileUtilsInstance);
    {
        Cyclic test3("test3", 10, MINS_IN_WEEK, 100, 0, "/test/path/", &mockFileUtilsInstance);

        ASSERT_EQ(Cyclic::allCyclic.size(), 3);
    }

    ASSERT_EQ(Cyclic::allCyclic.size(), 2);
};

TEST(CyclicTest, lookup){

    MockStatWrapper mockStatInstance;
    MockOFstreamWrapper mockOFstreamInstance;
    MockIFstreamWrapper mockIFstreamInstance;
    MockFileUtils mockFileUtilsInstance(&mockStatInstance, &mockOFstreamInstance, &mockIFstreamInstance);

    Cyclic* pointer_to_instance;

    Cyclic test1("test1", 6, 60, 100, 0, "/test/path/", &mockFileUtilsInstance);
    Cyclic test2("test2", 10, 120, 100, 0, "/test/path/", &mockFileUtilsInstance);
    {
        Cyclic test3("test3", 10, 1000, 100, 0, "/test/path/", &mockFileUtilsInstance);

        pointer_to_instance = Cyclic::lookup("test2");
        ASSERT_EQ(pointer_to_instance->mins_in_period, 120);
        ASSERT_EQ(pointer_to_instance, &test2);
    }
    pointer_to_instance = Cyclic::lookup("test3");
    ASSERT_EQ(NULL, pointer_to_instance);
};

TEST(CyclicTest, store){
    MockStatWrapper mockStatInstance;
    MockOFstreamWrapper mockOFstreamInstance;
    MockIFstreamWrapper mockIFstreamInstance;
    MockFileUtils mockFileUtilsInstance(&mockStatInstance, &mockOFstreamInstance, &mockIFstreamInstance);

    InSequence dummy;

    Cyclic test1("test1", 6, 60, 100, 0, "/test/path/", &mockFileUtilsInstance);
    test1.store(1, 1);
    test1.store(2, 2);
    test1.store(3, 3);
    test1.store(4, 4);
    test1.store(5, 5);
    // regex "\\d" does not seem to be matching digits so using "\\w" instead.
    EXPECT_CALL(mockFileUtilsInstance, write(_,_,MatchesRegex("^0\\s\\w+\\.\\w+$")))
        .Times(1);
    test1.store(6, 6);  // This should write out the last data received for the previous segment. (5)

    test1.store(7, 7);
    test1.store(8, 8);
    test1.store(9, 9);
    test1.store(10, 10);
    test1.store(11, 11);
    test1.store(11, 11);
    test1.store(11, 11);
    EXPECT_CALL(mockFileUtilsInstance, write(_,_,_))
        .Times(1);
    test1.store(12, 12);
    test1.store(12, 12);
    test1.store(12, 12);

    test1.store(13, 13);
    EXPECT_CALL(mockFileUtilsInstance, write(_,_,_))
        .Times(1);
    test1.store(18, 18);

    test1.store(15, 15);    // Simulate a bit of clock jitter.
    test1.store(12, 12);
    test1.store(18, 18);
    test1.store(19, 19);
    EXPECT_CALL(mockFileUtilsInstance, write(_,_,_))
        .Times(1);
    test1.store(30, 30);

    EXPECT_CALL(mockFileUtilsInstance, write(_,_,_))
        .Times(1);
    test1.store(58, 58);

    test1.store(59, 59);
    
    // regex "\\d" does not seem to be matching digits so using "\\w" instead.
    EXPECT_CALL(mockFileUtilsInstance, write(_,_,MatchesRegex("^9\\s\\w+\\.\\w+$")))
        .Times(1);
    // rename should happen after previous time segment has been written out.
    EXPECT_CALL(mockFileUtilsInstance, _rename(_,_))
        .Times(1);
    test1.store(0, 60);

    test1.store(1, 61);
    // regex "\\d" does not seem to be matching digits so using "\\w" instead.
    EXPECT_CALL(mockFileUtilsInstance, write(_,_,MatchesRegex("^0\\s\\w+\\.\\w+$")))
        .Times(1);
    test1.store(6, 66);

};


TEST(CyclicTest, storeStartHigh){
    // first value saved is over half way through the buffer.
    MockStatWrapper mockStatInstance;
    MockOFstreamWrapper mockOFstreamInstance;
    MockIFstreamWrapper mockIFstreamInstance;
    MockFileUtils mockFileUtilsInstance(&mockStatInstance, &mockOFstreamInstance, &mockIFstreamInstance);

    InSequence dummy;

    EXPECT_CALL(mockFileUtilsInstance, write(_,_,_))
        .Times(0);

    Cyclic test1("test1", 6, 60, 100, 0, "/test/path/", &mockFileUtilsInstance);
    test1.store(35, 35);
    test1.store(34, 34);
    test1.store(30, 30);
    EXPECT_CALL(mockFileUtilsInstance, write(_,_,_))
        .Times(1);
    test1.store(36, 36);

    EXPECT_CALL(mockFileUtilsInstance, write(_,_,_))
        .Times(1);
    EXPECT_CALL(mockFileUtilsInstance, _rename(_,_))
        .Times(1);
    test1.store(1, 61);

    EXPECT_CALL(mockFileUtilsInstance, write(_,_,_))
        .Times(1);
    test1.store(12, 72);
    
};

TEST(CyclicTest, read){
    MockStatWrapper mockStatInstance;
    MockOFstreamWrapper mockOFstreamInstance;
    MockIFstreamWrapper mockIFstreamInstance;
    MockFileUtils mockFileUtilsInstance(&mockStatInstance, &mockOFstreamInstance, &mockIFstreamInstance);

    InSequence dummy;

    EXPECT_CALL(mockFileUtilsInstance, write(_,_,_))
        .Times(0);

    Cyclic test1("test1", 2, 12, 4, 0, "/test/path/", &mockFileUtilsInstance);

    test1.store(0, 100);

    EXPECT_CALL(mockFileUtilsInstance, write(_,_,_))
        .Times(1);
    test1.store(4, 100);
    
    ASSERT_EQ(test1.read(0), 100/4);

    EXPECT_CALL(mockFileUtilsInstance, write(_,_,_))
        .Times(1);
    test1.store(8, 100);
    
    ASSERT_EQ(test1.read(4), 100/4);
    
    EXPECT_CALL(mockFileUtilsInstance, write(_,_,_))
        .Times(1);
    test1.store(0, 100);
    
    ASSERT_EQ(test1.read(8), 100/4);

    EXPECT_CALL(mockFileUtilsInstance, write(_,_,_))
        .Times(1);
    test1.store(4, 100);

    ASSERT_EQ(test1.read(0), 100/4 + (3.0/4)*(100/4));

    EXPECT_CALL(mockFileUtilsInstance, write(_,_,_))
        .Times(1);
    test1.store(8, 100);

    ASSERT_EQ(test1.read(4), 100/4 + (3.0/4)*(100/4));
}

TEST(CyclicTest, restoreFromDisk){
    struct stat buf_pass;   // Contents of buffer modified by stat() indicate path missing.
    buf_pass.st_mode = S_IFDIR;

    MockStatWrapper mockStatInstance;
    MockOFstreamWrapper mockOFstreamInstance;
    MockIFstreamWrapper mockIFstreamInstance;
    MockFileUtils mockFileUtilsInstance(&mockStatInstance, &mockOFstreamInstance, &mockIFstreamInstance);
    
    Cyclic test1("test1", 2, 12, 4, 0, "/test/path/", &mockFileUtilsInstance);

    EXPECT_CALL(mockFileUtilsInstance, readLine(_,"test1_previous",_))
        .WillOnce(SetArgPointee<2>("0 1.09"))   // Make sure floating point numbers work.
        .WillOnce(SetArgPointee<2>("1 1.01"))
        .WillOnce(SetArgPointee<2>("2 1"))
        .WillOnce(SetArgPointee<2>("3 1"))
        .WillOnce(SetArgPointee<2>("4 1"))
        .WillOnce(SetArgPointee<2>("5 1"))
        .WillRepeatedly(SetArgPointee<2>(""));

    EXPECT_CALL(mockFileUtilsInstance, readLine(_,"test1_active",_))
        .WillOnce(SetArgPointee<2>("2 2"))      // This "active" entry shold over-ride "previous" one.
        .WillRepeatedly(SetArgPointee<2>(""));


    EXPECT_CALL(mockStatInstance, _stat(_,_))
        .WillRepeatedly(DoAll(SetArgPointee<1>(buf_pass), Return(1)));

    InSequence dummy;

    EXPECT_CALL(mockFileUtilsInstance, write(_,_,"0 1.090000")) .Times(1);
    EXPECT_CALL(mockFileUtilsInstance, write(_,_,"1 1.010000")) .Times(1);
    EXPECT_CALL(mockFileUtilsInstance, write(_,_,"2 2.000000")) .Times(1);
    EXPECT_CALL(mockFileUtilsInstance, write(_,_,"3 1.000000")) .Times(1);
    EXPECT_CALL(mockFileUtilsInstance, write(_,_,"4 1.000000")) .Times(1);
    EXPECT_CALL(mockFileUtilsInstance, write(_,_,"5 1.000000")) .Times(1);
    EXPECT_CALL(mockFileUtilsInstance, write(_,_,_)) .Times(0);
    test1.restoreFromDisk();
}

TEST(CyclicTest, realInstance){
    const char* filenameActive = "/tmp/test1_active";
    const char* filenamePrevious = "/tmp/test1_previous";

    remove(filenameActive);
    remove(filenamePrevious);

    StatWrapperInterface statWrapper;
    OFstreamWrapper ofStreamWrapper;
    IFstreamWrapper ifStreamWrapper;

    FileUtils fileUtilsInstance(&statWrapper, &ofStreamWrapper, &ifStreamWrapper);

    {
        Cyclic test1("test1", 2, 12, 4, 0, "/tmp/", &fileUtilsInstance);

        test1.store(6, 10);
        test1.store(8, 10);
        test1.store(10, 10);
        test1.store(0, 20);
        test1.store(2, 20);
        test1.store(4, 20);
        test1.store(6, 20);
        test1.store(8, 20);
        test1.store(10, 20);
    }

    {
        Cyclic test1("test1", 2, 12, 4, 0, "/tmp/", &fileUtilsInstance);
        test1.restoreFromDisk();

        test1.store(0, 30);
        test1.store(2, 30);

        struct stat buffer;   
        ASSERT_EQ(stat(filenameActive, &buffer), 0);    // file exists.
        ASSERT_EQ(stat(filenamePrevious, &buffer), -1); // file missing.

        // TODO parse /tmp/test1_active to make sure it's contents are sane.

        ASSERT_EQ(test1.read(0), 45.0/4);
        ASSERT_EQ(test1.read(2), 20.0/4);
        ASSERT_EQ(test1.read(10), 10.0/4);
    }

    {
        Cyclic test1("test1", 2, 12, 4, 0, "/tmp/", &fileUtilsInstance);
        test1.restoreFromDisk();

        ASSERT_EQ(test1.read(0), 45.0/4);
        ASSERT_EQ(test1.read(2), 20.0/4);
        ASSERT_EQ(test1.read(10), 10.0/4);

        test1.store(10, 0);
        test1.store(0, 0);

        // filenameActive will have been moved to filenamePrevious.
        // No new filenameActive will have been created yet.

        struct stat buffer;
        ASSERT_EQ(stat(filenameActive, &buffer), -1);    // file missing.
        ASSERT_EQ(stat(filenamePrevious, &buffer), 0);   // file exists.
    }

    {
        Cyclic test1("test1", 2, 12, 4, 0, "/tmp/", &fileUtilsInstance);
        test1.restoreFromDisk();

        ASSERT_EQ(test1.read(0), 45.0/4);
        ASSERT_EQ(test1.read(2), 20.0/4);
        ASSERT_EQ(test1.read(10), 7.5/4);
    }
}


