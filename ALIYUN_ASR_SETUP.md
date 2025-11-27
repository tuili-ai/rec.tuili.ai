# 阿里云 ASR 配置指南

本项目已集成阿里云实时语音识别（ASR）服务，用于提词器和面试官功能的语音转文字。

## 前置条件

1. 阿里云账号
2. 开通智能语音交互服务
3. 获取 AccessKey ID 和 AccessKey Secret
4. 创建语音识别应用并获取 AppKey

## 配置步骤

### 1. 开通服务

访问 [阿里云智能语音交互控制台](https://nls-portal.console.aliyun.com/)

1. 开通"实时语音识别"服务
2. 创建项目/应用
3. 记录 AppKey

### 2. 获取 AccessKey

访问 [RAM 访问控制](https://ram.console.aliyun.com/manage/ak)

1. 创建 AccessKey（如果还没有）
2. 保存 AccessKey ID 和 AccessKey Secret（只显示一次，请妥善保管）

### 3. 配置环境变量

编辑项目根目录的 `.env.local` 文件：

```bash
# Aliyun ASR Configuration
ALIYUN_ACCESS_KEY_ID=你的AccessKey_ID
ALIYUN_ACCESS_KEY_SECRET=你的AccessKey_Secret
ALIYUN_APP_KEY=你的AppKey
```

### 4. 重启开发服务器

```bash
npm run dev
```

## 使用方法

启动应用后，点击 "Initialize" 按钮，然后选择以下功能：

- **Teleprompter（提词器）**: 实时转录您的语音，与提词文本同步高亮
- **Interviewer（面试官）**: 检测您的停顿并自动提供跟进问题

## API 文档参考

- [获取 Token](https://help.aliyun.com/zh/isi/getting-started/obtain-an-access-token)
- [实时语音识别 API](https://help.aliyun.com/zh/isi/developer-reference/api-reference)
- [Node.js SDK](https://help.aliyun.com/zh/isi/developer-reference/sdk-for-node-js)

## 技术实现

- 使用 WebSocket 连接到阿里云 ASR 网关
- 实时发送 PCM 音频流（16kHz, 16bit）
- 接收实时转录结果
- 支持中英文混合识别
- 启用标点符号预测和文本规范化

## 故障排查

### 连接失败

1. 检查网络连接
2. 确认阿里云服务已开通
3. 验证 AccessKey 和 AppKey 是否正确
4. 查看浏览器控制台错误信息

### Token 获取失败

1. 确认 AccessKey ID 和 Secret 正确
2. 检查 RAM 权限配置
3. 确认账户余额充足

### 识别效果不佳

1. 确保麦克风权限已授予
2. 检查环境噪音
3. 调整麦克风音量
4. 尝试更清晰的发音

## 费用说明

阿里云智能语音交互按使用量计费，具体价格请参考[官方定价](https://www.aliyun.com/price/product#/nls/detail)。

建议开发测试时：
- 使用资源包或按量付费
- 设置费用预警
- 监控使用量
