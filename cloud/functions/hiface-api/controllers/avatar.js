const BaseController = require('./base-controller.js')
const uuid = require('uuid')

const uuidv4 = uuid.v4

const COLLECTION_NAME = 'hiface-avatars'
const COLLECTION_USER_NAME = 'hiface-users'

const getImageUrl = async (cloud, fileID) => {
  if (!fileID) return ''

  const { fileList } = await cloud.getTempFileURL({
    fileList: [fileID]
  })
  return fileList[0].tempFileURL
}

class AvatarController extends BaseController {
  async get(event) {
    const { uuid } = event
    // 微信环境下获取openId
    const { OPENID } = this.cloud.getWXContext() // 这里获取到的 openId 和 appId 是可信的

    let result = await this.cloud.db.collection(COLLECTION_NAME)
      .where({
        uuid,
        isDelete: false
      })
      .limit(1)
      .field({
        _id: false,
        isDelete: false,
        appId: false,
      })
      .get()
      .then(async result => {
        let { data } = result

        
        if (data && data.length >= 1) {
          const { avatarFileID, openId } = data[0]
          let imageUrl = await getImageUrl(this.cloud, avatarFileID)
          return this.success({
            ...data[0],
            isAuthor: OPENID === openId,
            avatarImageUrl: imageUrl
          })
        }
        return this.fail(-10000, '数据不存在')
      })
      .catch(() => this.fail())

    return result
  }

  async save(event) {
    /**
   * page: 第几页
   * num: 每页几条数据
   * condition： 查询条件，例如 { name: '李白' }
   */

    const { avatarFileID, ageType, themeId, themeName } = event
    console.log(event)

    const { OPENID, APPID } = this.cloud.getWXContext() // 这里获取到的 openId 和 appId 是可信的

    try {
      const result = await this.cloud.db.collection(COLLECTION_USER_NAME).where({
        wxOpenId: OPENID
      }).get()

      const { user_id = '', userId = '' } = result.data[0] || {}
      console.log('user_id', result.data, user_id)
      const { _id } = await this.cloud.db.collection(COLLECTION_NAME)
        .add({
          // data 字段表示需新增的 JSON 数据
          data: {
            createTime: new Date(),
            updateTime: new Date(),
            openId: OPENID,
            appId: APPID,
            uuid: uuidv4(),
            isDelete: false,
            userId: userId || user_id || 0,
            avatarFileID,
            ageType,
            themeId,
            themeName
          }
        })

      const one = await this.cloud.db.collection(COLLECTION_NAME)
        .doc(_id)
        .field({
          _id: false,
          isDelete: false,
          appId: false,

        })
        .get()
      
      return this.success(one.data)

    } catch (error) {
      
      console.log(error)
      return this.fail(-100010, '添加失败', error)
    }
  }

  async list(event) {
    /**
   * page: 第几页
   * num: 每页几条数据
   * condition： 查询条件，例如 { name: '李白' }
   */

    const { pageNo = 1, pageSize = 10, condition = {}, orderBy = {} } = event
    console.log(event)

    const { OPENID } = this.cloud.getWXContext() // 这里获取到的 openId 和 appId 是可信的
    console.log('OPENID :>> ', OPENID);


    try {
      let { data: totalList } = await this.cloud.db.collection(COLLECTION_NAME).limit(1000).get()
      
      let total = totalList.length
      
      let pageTotal = Math.ceil(total / pageSize)

      if (pageNo > pageTotal) {
        return this.success({
          items: [],
          pageNo,
          total
        })
      }
      console.log('count :>> ', total, pageTotal)

      let operation = this.cloud.db.collection(COLLECTION_NAME)
        .where({
          openId: OPENID,
          ...condition
        })
        .skip(pageSize * (pageNo - 1))
        .limit(pageSize)
        .field({
          _id: false,
          isDelete: false,
          appId: false,
        })

      console.log('orderType :', orderBy);
      if (orderBy.field) {
        console.log('orderBy :>> ', orderBy);
        operation = operation.orderBy(orderBy.field, orderBy.orderType || 'desc')
      } else {
        operation = operation.orderBy('order', 'asc')
      }
      let { data } = await operation.get()
      
      if (data) {
        return this.success({
          items: data,
          nextPage: pageTotal > pageNo,
          pageNo,
          total
        })
      }

      return this.fail(-10000, '数据不存在')


    } catch (err) {
      console.log(err)
      return this.fail(-10001, '数据不存在', err)
    }
  }
}

module.exports = AvatarController
