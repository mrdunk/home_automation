#include "../cyclicStore.h"
#include "gmock/gmock.h"
#include "gtest/gtest.h"

using ::testing::AtLeast;
using ::testing::_;
using ::testing::Return;
using ::testing::SetArgPointee;



class MockFileUtils : public FileUtils {
    public:
        MOCK_METHOD2(_stat, int(const char *path, struct stat *p_buf));
};


TEST(FileUtilsTest, DefaultConstructor){
    MockFileUtils instance;
}

const string path = "/test/path";
const string filename = "testFilename";
TEST(FileUtilsTest, writable){
    // TODO Test file_mutex.lock().
    struct stat buf_fail;
    struct stat buf_pass;
    buf_pass.st_mode = S_IFDIR;

    MockFileUtils instance;

    EXPECT_CALL(instance, _stat(_,_))
        .Times(AtLeast(1))
        .WillOnce(DoAll(SetArgPointee<1>(buf_pass), Return(-1)))
        .WillOnce(DoAll(SetArgPointee<1>(buf_fail), Return(1)))
        .WillOnce(DoAll(SetArgPointee<1>(buf_pass), Return(1)));

    EXPECT_EQ(-1, instance.writable(path, filename));
    EXPECT_EQ(-1, instance.writable(path, filename));
    EXPECT_EQ(1, instance.writable(path, filename));

}
