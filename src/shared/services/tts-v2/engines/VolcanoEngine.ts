/**
 * 火山引擎 TTS 引擎 (字节跳动)
 * 支持 100+ 种音色和多种情感风格
 * 
 * 免费音色包括：
 * - BV700_streaming (灿灿) - 22种情感
 * - BV001_streaming (通用女声)
 * - BV002_streaming (通用男声)
 * - BV701_streaming (擎苍) - 10种情感
 * - BV021_streaming (东北老铁)
 * - BV503_streaming (活力女声-Ariana)
 * 等
 */

import { BaseTTSEngine } from './BaseTTSEngine';
import type { TTSEngineType, TTSSynthesisResult, VolcanoTTSConfig } from '../types';
import { universalFetch } from '../../../utils/universalFetch';

// V3 默认 Resource ID
export const VOLCANO_RESOURCE_IDS = {
  bigtts: 'volc.service_type.10029',   // 大模型语音合成 (字符版)
  seedTts2: 'seed-tts-2.0',            // 豆包语音合成 2.0
} as const;

/** 是否为大模型音色 (bigtts / 声音复刻 ICL) */
export function isBigModelVoice(voiceType: string): boolean {
  return voiceType.includes('_bigtts') || voiceType.startsWith('ICL_') || voiceType.startsWith('S_');
}

/** 是否为豆包语音合成 2.0 (uranus) 音色，仅 V3 接口支持 */
export function isSeedTts2Voice(voiceType: string): boolean {
  return voiceType.includes('_uranus_');
}

// 火山引擎音色列表 (完整版 - 基于官方文档 https://www.volcengine.com/docs/6561/97465)
export const VOLCANO_VOICES = {
  // ========== 通用场景 ==========
  '灿灿2.0': 'BV700_V2_streaming',
  '灿灿': 'BV700_streaming',
  '炀炀': 'BV705_streaming',
  '擎苍2.0': 'BV701_V2_streaming',
  '擎苍': 'BV701_streaming',
  '通用女声2.0': 'BV001_V2_streaming',
  '通用女声': 'BV001_streaming',
  '通用男声': 'BV002_streaming',
  '超自然音色-梓梓2.0': 'BV406_V2_streaming',
  '超自然音色-梓梓': 'BV406_streaming',
  '超自然音色-燃燃2.0': 'BV407_V2_streaming',
  '超自然音色-燃燃': 'BV407_streaming',
  
  // ========== 有声阅读 ==========
  '阳光青年': 'BV123_streaming',
  '反卷青年': 'BV120_streaming',
  '通用赘婿': 'BV119_streaming',
  '古风少御': 'BV115_streaming',
  '霸气青叔': 'BV107_streaming',
  '质朴青年': 'BV100_streaming',
  '温柔淑女': 'BV104_streaming',
  '开朗青年': 'BV004_streaming',
  '甜宠少御': 'BV113_streaming',
  '儒雅青年': 'BV102_streaming',
  
  // ========== 智能助手 ==========
  '甜美小源': 'BV405_streaming',
  '亲切女声': 'BV007_streaming',
  '知性女声': 'BV009_streaming',
  '诚诚': 'BV419_streaming',
  '童童': 'BV415_streaming',
  '亲切男声': 'BV008_streaming',
  
  // ========== 视频配音 ==========
  '译制片男声': 'BV408_streaming',
  '懒小羊': 'BV426_streaming',
  '清新文艺女声': 'BV428_streaming',
  '鸡汤女声': 'BV403_streaming',
  '智慧老者': 'BV158_streaming',
  '慈爱姥姥': 'BV157_streaming',
  '说唱小哥': 'BR001_streaming',
  '活力解说男': 'BV410_streaming',
  '影视解说小帅': 'BV411_streaming',
  '解说小帅-多情感': 'BV437_streaming',
  '影视解说小美': 'BV412_streaming',
  '纨绔青年': 'BV159_streaming',
  '直播一姐': 'BV418_streaming',
  '沉稳解说男': 'BV142_streaming',
  '潇洒青年': 'BV143_streaming',
  '阳光男声': 'BV056_streaming',
  '活泼女声': 'BV005_streaming',
  '小萝莉': 'BV064_streaming',
  
  // ========== 特色音色 ==========
  '奶气萌娃': 'BV051_streaming',
  '动漫海绵': 'BV063_streaming',
  '动漫海星': 'BV417_streaming',
  '动漫小新': 'BV050_streaming',
  '天才童声': 'BV061_streaming',
  
  // ========== 广告配音 ==========
  '促销男声': 'BV401_streaming',
  '促销女声': 'BV402_streaming',
  '磁性男声': 'BV006_streaming',
  
  // ========== 新闻播报 ==========
  '新闻女声': 'BV011_streaming',
  '新闻男声': 'BV012_streaming',
  
  // ========== 教育场景 ==========
  '知性姐姐-双语': 'BV034_streaming',
  '温柔小哥': 'BV033_streaming',
  
  // ========== 方言 ==========
  // 东北话
  '东北老铁': 'BV021_streaming',
  '东北丫头': 'BV020_streaming',
  // 西安话
  '西安佟掌柜': 'BV210_streaming',
  // 上海话
  '沪上阿姐': 'BV217_streaming',
  // 广西普通话
  '广西表哥': 'BV213_streaming',
  // 台湾普通话
  '甜美台妹': 'BV025_streaming',
  '台普男声': 'BV227_streaming',
  // 粤语
  '港剧男神': 'BV026_streaming',
  '广东女仔': 'BV424_streaming',
  // 天津话
  '相声演员': 'BV212_streaming',
  // 川渝话
  '重庆小伙': 'BV019_streaming',
  '四川甜妹儿': 'BV221_streaming',
  '重庆幺妹儿': 'BV423_streaming',
  // 郑州话
  '乡村企业家': 'BV214_streaming',
  // 湖南
  '湖南妹坨': 'BV226_streaming',
  '长沙靓女': 'BV216_streaming',
  // 多方言
  '方言灿灿': 'BV704_streaming',
  
  // ========== 美式英语 ==========
  '慵懒女声-Ava': 'BV511_streaming',
  '议论女声-Alicia': 'BV505_streaming',
  '情感女声-Lawrence': 'BV138_streaming',
  '美式女声-Amelia': 'BV027_streaming',
  '讲述女声-Amanda': 'BV502_streaming',
  '活力女声-Ariana': 'BV503_streaming',
  '活力男声-Jackson': 'BV504_streaming',
  '天才少女': 'BV421_streaming',
  'Stefan': 'BV702_streaming',
  '天真萌娃-Lily': 'BV506_streaming',
  
  // ========== 英式英语 ==========
  '亲切女声-Anna': 'BV040_streaming',
  
  // ========== 澳洲英语 ==========
  '澳洲男声-Henry': 'BV516_streaming',
  
  // ========== 日语 ==========
  '元气少女': 'BV520_streaming',
  '萌系少女': 'BV521_streaming',
  '气质女声': 'BV522_streaming',
  '日语男声': 'BV524_streaming',
  
  // ========== 葡萄牙语 ==========
  '活力男声-Carlos': 'BV531_streaming',
  '活力女声-葡语': 'BV530_streaming',
  
  // ========== 西班牙语 ==========
  '气质御姐-西语': 'BV065_streaming',
  
  // ========== 豆包大模型音色 (bigtts) - 完整版 ==========
  // 通用场景
  '[豆包]Vivi': 'zh_female_vv_mars_bigtts',
  '[豆包]灿灿': 'zh_female_cancan_mars_bigtts',
  '[豆包]爽快思思': 'zh_female_shuangkuaisisi_moon_bigtts',
  '[豆包]温暖阿虎': 'zh_male_wennuanahu_moon_bigtts',
  '[豆包]少年梓辛': 'zh_male_shaonianzixin_moon_bigtts',
  '[豆包]邻家女孩': 'zh_female_linjianvhai_moon_bigtts',
  '[豆包]渊博小叔': 'zh_male_yuanboxiaoshu_moon_bigtts',
  '[豆包]阳光青年': 'zh_male_yangguangqingnian_moon_bigtts',
  '[豆包]甜美小源': 'zh_female_tianmeixiaoyuan_moon_bigtts',
  '[豆包]清澈梓梓': 'zh_female_qingchezizi_moon_bigtts',
  '[豆包]邻家男孩': 'zh_male_linjiananhai_moon_bigtts',
  '[豆包]甜美悦悦': 'zh_female_tianmeiyueyue_moon_bigtts',
  '[豆包]心灵鸡汤': 'zh_female_xinlingjitang_moon_bigtts',
  '[豆包]解说小明': 'zh_male_jieshuoxiaoming_moon_bigtts',
  '[豆包]开朗姐姐': 'zh_female_kailangjiejie_moon_bigtts',
  '[豆包]亲切女声': 'zh_female_qinqienvsheng_moon_bigtts',
  '[豆包]温柔小雅': 'zh_female_wenrouxiaoya_moon_bigtts',
  '[豆包]快乐小东': 'zh_male_xudong_conversation_wvae_bigtts',
  '[豆包]文静毛毛': 'zh_female_maomao_conversation_wvae_bigtts',
  '[豆包]悠悠君子': 'zh_male_M100_conversation_wvae_bigtts',
  '[豆包]魅力苏菲': 'zh_female_sophie_conversation_wvae_bigtts',
  '[豆包]阳光阿辰': 'zh_male_qingyiyuxuan_mars_bigtts',
  '[豆包]甜美桃子': 'zh_female_tianmeitaozi_mars_bigtts',
  '[豆包]清新女声': 'zh_female_qingxinnvsheng_mars_bigtts',
  '[豆包]知性女声': 'zh_female_zhixingnvsheng_mars_bigtts',
  '[豆包]清爽男大': 'zh_male_qingshuangnanda_mars_bigtts',
  '[豆包]温柔小哥': 'zh_male_wenrouxiaoge_mars_bigtts',
  
  // 角色扮演
  '[豆包]傲娇霸总': 'zh_male_aojiaobazong_moon_bigtts',
  '[豆包]病娇姐姐': 'ICL_zh_female_bingjiaojiejie_tob',
  '[豆包]妩媚御姐': 'ICL_zh_female_wumeiyujie_tob',
  '[豆包]傲娇女友': 'ICL_zh_female_aojiaonvyou_tob',
  '[豆包]冷酷哥哥': 'ICL_zh_male_lengkugege_v1_tob',
  '[豆包]成熟姐姐': 'ICL_zh_female_chengshujiejie_tob',
  '[豆包]贴心女友': 'ICL_zh_female_tiexinnvyou_tob',
  '[豆包]性感御姐': 'ICL_zh_female_xingganyujie_tob',
  '[豆包]病娇弟弟': 'ICL_zh_male_bingjiaodidi_tob',
  '[豆包]傲慢少爷': 'ICL_zh_male_aomanshaoye_tob',
  '[豆包]腹黑公子': 'ICL_zh_male_fuheigongzi_tob',
  '[豆包]暖心学姐': 'ICL_zh_female_nuanxinxuejie_tob',
  '[豆包]可爱女生': 'ICL_zh_female_keainvsheng_tob',
  '[豆包]知性温婉': 'ICL_zh_female_zhixingwenwan_tob',
  '[豆包]暖心体贴': 'ICL_zh_male_nuanxintitie_tob',
  '[豆包]开朗轻快': 'ICL_zh_male_kailangqingkuai_tob',
  '[豆包]活泼爽朗': 'ICL_zh_male_huoposhuanglang_tob',
  '[豆包]率真小伙': 'ICL_zh_male_shuaizhenxiaohuo_tob',
  '[豆包]温柔文雅': 'ICL_zh_female_wenrouwenya_tob',
  '[豆包]温柔女神': 'ICL_zh_female_wenrounvshen_239eff5e8ffa_tob',
  '[豆包]炀炀': 'ICL_zh_male_BV705_streaming_cs_tob',
  
  // 视频配音
  '[豆包]擎苍': 'zh_male_qingcang_mars_bigtts',
  '[豆包]霸气青叔': 'zh_male_baqiqingshu_mars_bigtts',
  '[豆包]温柔淑女': 'zh_female_wenroushunv_mars_bigtts',
  '[豆包]儒雅青年': 'zh_male_ruyaqingnian_mars_bigtts',
  '[豆包]悬疑解说': 'zh_male_changtianyi_mars_bigtts',
  '[豆包]古风少御': 'zh_female_gufengshaoyu_mars_bigtts',
  '[豆包]活力小哥': 'zh_male_yangguangqingnian_mars_bigtts',
  '[豆包]鸡汤妹妹': 'zh_female_jitangmeimei_mars_bigtts',
  '[豆包]贴心女声': 'zh_female_tiexinnvsheng_mars_bigtts',
  '[豆包]萌丫头': 'zh_female_mengyatou_mars_bigtts',
  '[豆包]磁性解说男声': 'zh_male_jieshuonansheng_mars_bigtts',
  '[豆包]广告解说': 'zh_male_chunhui_mars_bigtts',
  '[豆包]少儿故事': 'zh_female_shaoergushi_mars_bigtts',
  '[豆包]天才童声': 'zh_male_tiancaitongsheng_mars_bigtts',
  '[豆包]俏皮女声': 'zh_female_qiaopinvsheng_mars_bigtts',
  '[豆包]懒音绵宝': 'zh_male_lanxiaoyang_mars_bigtts',
  '[豆包]亮嗓萌仔': 'zh_male_dongmanhaimian_mars_bigtts',
  '[豆包]暖阳女声': 'zh_female_kefunvsheng_mars_bigtts',
  
  // 特色/IP音色
  '[豆包]猴哥': 'zh_male_sunwukong_mars_bigtts',
  '[豆包]熊二': 'zh_male_xionger_mars_bigtts',
  '[豆包]佩奇猪': 'zh_female_peiqi_mars_bigtts',
  '[豆包]樱桃丸子': 'zh_female_yingtaowanzi_mars_bigtts',
  '[豆包]武则天': 'zh_female_wuzetian_mars_bigtts',
  '[豆包]顾姐': 'zh_female_gujie_mars_bigtts',
  '[豆包]四郎': 'zh_male_silang_mars_bigtts',
  '[豆包]鲁班七号': 'zh_male_lubanqihao_mars_bigtts',
  
  // 多情感音色
  '[豆包]冷酷哥哥-多情感': 'zh_male_lengkugege_emo_v2_mars_bigtts',
  '[豆包]高冷御姐-多情感': 'zh_female_gaolengyujie_emo_v2_mars_bigtts',
  '[豆包]傲娇霸总-多情感': 'zh_male_aojiaobazong_emo_v2_mars_bigtts',
  '[豆包]邻居阿姨-多情感': 'zh_female_linjuayi_emo_v2_mars_bigtts',
  '[豆包]儒雅男友-多情感': 'zh_male_ruyayichen_emo_v2_mars_bigtts',
  '[豆包]俊朗男友-多情感': 'zh_male_junlangnanyou_emo_v2_mars_bigtts',
  '[豆包]柔美女友-多情感': 'zh_female_roumeinvyou_emo_v2_mars_bigtts',
  '[豆包]阳光青年-多情感': 'zh_male_yangguangqingnian_emo_v2_mars_bigtts',
  '[豆包]爽快思思-多情感': 'zh_female_shuangkuaisisi_emo_v2_mars_bigtts',
  '[豆包]深夜播客': 'zh_male_shenyeboke_emo_v2_mars_bigtts',
  
  // 英文音色
  '[豆包]Lauren': 'en_female_lauren_moon_bigtts',
  '[豆包]Amanda': 'en_female_amanda_mars_bigtts',
  '[豆包]Adam': 'en_male_adam_mars_bigtts',
  '[豆包]Jackson': 'en_male_jackson_mars_bigtts',
  '[豆包]Emily': 'en_female_emily_mars_bigtts',
  '[豆包]Smith': 'en_male_smith_mars_bigtts',
  '[豆包]Anna': 'en_female_anna_mars_bigtts',
  '[豆包]Sarah': 'en_female_sarah_mars_bigtts',
  '[豆包]Dryw': 'en_male_dryw_mars_bigtts',
  '[豆包]Nara': 'en_female_nara_moon_bigtts',
  '[豆包]Bruce': 'en_male_bruce_moon_bigtts',
  '[豆包]Michael': 'en_male_michael_moon_bigtts',
  '[豆包]Daisy': 'en_female_dacey_conversation_wvae_bigtts',
  '[豆包]Luna': 'en_female_sarah_new_conversation_wvae_bigtts',
  '[豆包]Owen': 'en_male_charlie_conversation_wvae_bigtts',
  '[豆包]Lucas': 'zh_male_M100_conversation_wvae_bigtts',
  '[豆包]Candice-多情感': 'en_female_candice_emo_v2_mars_bigtts',
  '[豆包]Serena-多情感': 'en_female_skye_emo_v2_mars_bigtts',
  '[豆包]Glen-多情感': 'en_male_glen_emo_v2_mars_bigtts',
  '[豆包]Sylus-多情感': 'en_male_sylus_emo_v2_mars_bigtts',
  
  // 客服场景
  '[豆包]理性圆子': 'ICL_zh_female_lixingyuanzi_cs_tob',
  '[豆包]清甜桃桃': 'ICL_zh_female_qingtiantaotao_cs_tob',
  '[豆包]清晰小雪': 'ICL_zh_female_qingxixiaoxue_cs_tob',
  '[豆包]开朗婷婷': 'ICL_zh_female_kailangtingting_cs_tob',
  '[豆包]温婉珊珊': 'ICL_zh_female_wenwanshanshan_cs_tob',
  '[豆包]甜美小雨': 'ICL_zh_female_tianmeixiaoyu_cs_tob',
  '[豆包]灵动欣欣': 'ICL_zh_female_lingdongxinxin_cs_tob',
  '[豆包]乖巧可儿': 'ICL_zh_female_guaiqiaokeer_cs_tob',
  '[豆包]阳光洋洋': 'ICL_zh_male_yangguangyangyang_cs_tob',

  // ========== 豆包语音合成 2.0 (uranus) - 仅 V3 接口支持 ==========
  '[豆包2.0]小何': 'zh_female_xiaohe_uranus_bigtts',
  '[豆包2.0]Vivi': 'zh_female_vv_uranus_bigtts',
  '[豆包2.0]云舟': 'zh_male_m191_uranus_bigtts',
  '[豆包2.0]小天': 'zh_male_taocheng_uranus_bigtts',
  '[豆包2.0]刘飞': 'zh_male_liufei_uranus_bigtts',
  '[豆包2.0]魅力苏菲': 'zh_male_sophie_uranus_bigtts',
  '[豆包2.0]清新女声': 'zh_female_qingxinnvsheng_uranus_bigtts',
  '[豆包2.0]甜美小源': 'zh_female_tianmeixiaoyuan_uranus_bigtts',
  '[豆包2.0]甜美桃子': 'zh_female_tianmeitaozi_uranus_bigtts',
  '[豆包2.0]爽快思思': 'zh_female_shuangkuaisisi_uranus_bigtts',
  '[豆包2.0]邻家女孩': 'zh_female_linjianvhai_uranus_bigtts',
  '[豆包2.0]少年梓辛': 'zh_male_shaonianzixin_uranus_bigtts',
  '[豆包2.0]魅力女友': 'zh_female_meilinvyou_uranus_bigtts',
  '[豆包2.0]流畅女声': 'zh_female_liuchangnv_uranus_bigtts',
  '[豆包2.0]儒雅逸辰': 'zh_male_ruyayichen_uranus_bigtts',
  '[豆包2.0]知性灿灿': 'zh_female_cancan_uranus_bigtts',
  '[豆包2.0]撒娇学妹': 'zh_female_sajiaoxuemei_uranus_bigtts',
  '[豆包2.0]猴哥': 'zh_male_sunwukong_uranus_bigtts',
  '[豆包2.0]佩奇猪': 'zh_female_peiqi_uranus_bigtts',
} as const;

// 支持的情感/风格列表 (完整版 - 基于官方文档 https://www.volcengine.com/docs/6561/1257544)
export const VOLCANO_EMOTIONS = {
  // ========== 基础情感 ==========
  'happy': '开心',
  'sad': '悲伤',
  'angry': '愤怒',
  'scare': '害怕',
  'hate': '厌恶',
  'surprise': '惊讶',
  'tear': '哭腔',
  'novel_dialog': '平和',
  'excited': '激动',
  'coldness': '冷漠',
  'neutral': '中性',
  'depressed': '沮丧',
  'fear': '恐惧',
  
  // ========== 交流情感 ==========
  'pleased': '愉悦',
  'sorry': '抱歉',
  'annoyed': '嗔怪',
  'shy': '害羞',
  'tender': '温柔',
  
  // ========== 专业风格 ==========
  'customer_service': '客服',
  'professional': '专业',
  'serious': '严肃',
  'assistant': '助手',
  'advertising': '广告',
  'news': '新闻播报',
  'entertainment': '娱乐八卦',
  
  // ========== 叙述风格 ==========
  'narrator': '旁白-舒缓',
  'narrator_immersive': '旁白-沉浸',
  'storytelling': '讲故事',
  'radio': '情感电台',
  'chat': '自然对话',
  
  // ========== 特色风格 ==========
  'comfort': '安慰鼓励',
  'lovey-dovey': '撒娇',
  'energetic': '可爱元气',
  'conniving': '绿茶',
  'tsundere': '傲娇',
  'charming': '娇媚',
  'yoga': '瑜伽',
  'tension': '咆哮/焦急',
  'magnetic': '磁性',
  'vocal-fry': '气泡音',
  'asmr': '低语ASMR',
  'dialect': '方言',
  
  // ========== 英文专用情感 ==========
  'warm': '温暖',
  'affectionate': '深情',
  'authoritative': '权威',
} as const;

export class VolcanoEngine extends BaseTTSEngine {
  readonly name: TTSEngineType = 'volcano';
  readonly priority = 6;
  
  private static readonly HTTP_API_URL = 'https://openspeech.bytedance.com/api/v1/tts';
  private static readonly HTTP_API_V3_URL = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';
  
  protected config: VolcanoTTSConfig = {
    enabled: false,
    appId: '',
    accessToken: '',
    cluster: 'volcano_tts',
    apiVersion: 'auto',
    resourceId: '',
    model: '',
    voiceType: 'BV001_streaming',
    emotion: '',
    speed: 1.0,
    volume: 1.0,
    pitch: 1.0,
    encoding: 'mp3',
  };
  
  protected async doInitialize(): Promise<void> {
    // 火山引擎不需要预热
  }
  
  isAvailable(): boolean {
    return this.config.enabled && !!this.config.appId && !!this.config.accessToken;
  }
  
  async synthesize(text: string): Promise<TTSSynthesisResult> {
    if (!this.config.appId || !this.config.accessToken) {
      return { success: false, error: 'App ID 或 Access Token 未设置' };
    }
    
    if (this.resolveApiVersion() === 'v3') {
      return this.synthesizeV3(text);
    }
    return this.synthesizeV1(text);
  }
  
  /**
   * 解析实际使用的接口版本
   * auto 模式下按音色自动路由：大模型音色走 V3，传统 BV 音色走 V1
   */
  private resolveApiVersion(): 'v1' | 'v3' {
    const version = this.config.apiVersion || 'auto';
    if (version === 'v1' || version === 'v3') {
      return version;
    }
    return isBigModelVoice(this.config.voiceType) ? 'v3' : 'v1';
  }
  
  /**
   * V1 HTTP 非流式接口 (历史接口，传统 BV 音色)
   */
  private async synthesizeV1(text: string): Promise<TTSSynthesisResult> {
    try {
      const requestBody = this.buildRequestBody(text);
      
      const response = await universalFetch(VolcanoEngine.HTTP_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer;${this.config.accessToken}`,
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: `火山引擎 TTS 请求失败: ${response.status} ${JSON.stringify(errorData)}`,
        };
      }
      
      const result = await response.json();
      
      // 检查响应状态
      if (result.code !== 3000) {
        return {
          success: false,
          error: `火山引擎 TTS 错误: ${result.message || '未知错误'} (code: ${result.code})`,
        };
      }
      
      // 解码 base64 音频数据
      if (!result.data) {
        return {
          success: false,
          error: '未收到音频数据',
        };
      }
      
      const audioData = this.base64ToArrayBuffer(result.data);
      const mimeType = this.getMimeType();
      
      return {
        success: true,
        audioData,
        mimeType,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * V3 HTTP 单向流式接口 (大模型语音合成)
   * 鉴权使用 Header: X-Api-App-Id / X-Api-Access-Key / X-Api-Resource-Id
   * 响应为 NDJSON 流，音频数据在每行 JSON 的 data 字段 (base64)
   */
  private async synthesizeV3(text: string): Promise<TTSSynthesisResult> {
    try {
      const response = await universalFetch(VolcanoEngine.HTTP_API_V3_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-App-Id': this.config.appId,
          'X-Api-Access-Key': this.config.accessToken,
          'X-Api-Resource-Id': this.getResourceId(),
          'X-Api-Request-Id': this.generateRequestId(),
        },
        body: JSON.stringify(this.buildRequestBodyV3(text)),
        responseType: 'text',
        timeout: 60000,
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        return {
          success: false,
          error: this.mapV3Error(response.status, errorText),
        };
      }
      
      const bodyText = await response.text();
      const { audioChunks, errorMessage } = this.parseV3Response(bodyText);
      
      if (audioChunks.length === 0) {
        return {
          success: false,
          error: errorMessage || '火山引擎 TTS (V3): 未收到音频数据',
        };
      }
      
      const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const merged = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of audioChunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      
      return {
        success: true,
        audioData: merged.buffer,
        mimeType: this.getMimeType(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * 解析 V3 NDJSON 流式响应
   */
  private parseV3Response(bodyText: string): { audioChunks: Uint8Array[]; errorMessage: string } {
    const audioChunks: Uint8Array[] = [];
    let errorMessage = '';
    
    for (const line of bodyText.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      try {
        const chunk = JSON.parse(trimmed);
        if (chunk.data) {
          const binaryString = atob(chunk.data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          audioChunks.push(bytes);
        } else if (typeof chunk.code === 'number' && chunk.code !== 0 && chunk.code !== 20000000) {
          errorMessage = this.mapV3Error(chunk.code, chunk.message || '');
        }
      } catch {
        // 忽略无法解析的行
      }
    }
    
    return { audioChunks, errorMessage };
  }
  
  /**
   * 将 V3 错误码映射为可读提示
   */
  private mapV3Error(code: number, message: string): string {
    const base = `火山引擎 TTS (V3) 错误: ${message || '未知错误'} (code: ${code})`;
    if (code === 401 || code === 403 || /authenticat|invalid.*key|unauthorized/i.test(message)) {
      return `${base}\n请检查 App ID 与 Access Token 是否正确`;
    }
    if (/resource|service.*not.*open|not.*purchased|权限|未开通/i.test(message)) {
      return `${base}\n请在火山引擎控制台开通"大模型语音合成"服务 (Resource ID: ${this.getResourceId()})`;
    }
    if (/speaker|voice/i.test(message)) {
      return `${base}\n当前音色 ${this.config.voiceType} 可能不支持 V3 接口或未授权`;
    }
    return base;
  }
  
  /**
   * 获取 V3 Resource ID：用户指定优先，否则按音色自动选择
   */
  private getResourceId(): string {
    if (this.config.resourceId) {
      return this.config.resourceId;
    }
    return isSeedTts2Voice(this.config.voiceType)
      ? VOLCANO_RESOURCE_IDS.seedTts2
      : VOLCANO_RESOURCE_IDS.bigtts;
  }
  
  /**
   * 构建 V3 请求体
   * speech_rate / loudness_rate 取值范围 [-50, 100]，0 为默认 (1 倍)
   */
  private buildRequestBodyV3(text: string): Record<string, unknown> {
    const toRate = (ratio: number | undefined): number => {
      const r = ratio ?? 1.0;
      return Math.round(Math.min(100, Math.max(-50, (r - 1) * 100)));
    };
    
    const audioParams: Record<string, unknown> = {
      format: this.config.encoding || 'mp3',
      sample_rate: 24000,
      speech_rate: toRate(this.config.speed),
      loudness_rate: toRate(this.config.volume),
    };
    
    if (this.config.emotion) {
      audioParams.emotion = this.config.emotion;
    }
    
    const reqParams: Record<string, unknown> = {
      text,
      speaker: this.config.voiceType,
      audio_params: audioParams,
    };
    
    if (this.config.model) {
      reqParams.model = this.config.model;
    }
    
    return {
      user: {
        uid: 'aetherlink_user',
      },
      req_params: reqParams,
    };
  }
  
  stop(): void {
    // HTTP API 不需要停止操作
  }
  
  updateConfig(config: Partial<VolcanoTTSConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * 根据音色类型自动选择 cluster
   * 
   * cluster 说明：
   * - volcano_tts: 语音合成（包括传统音色和大模型音色 bigtts）
   * - volcano_mega: 声音复刻大模型 1.0
   * - volcano_icl: 声音复刻大模型 2.0
   */
  private getClusterForVoice(_voiceType: string): string {
    // 如果用户手动指定了 cluster，优先使用
    if (this.config.cluster) {
      return this.config.cluster;
    }
    
    // 所有语音合成音色（包括传统和大模型）都使用 volcano_tts
    return 'volcano_tts';
  }
  
  /**
   * 构建请求体
   */
  private buildRequestBody(text: string): Record<string, unknown> {
    const voiceType = this.config.voiceType;
    const cluster = this.getClusterForVoice(voiceType);
    
    const request: Record<string, unknown> = {
      app: {
        appid: this.config.appId,
        token: this.config.accessToken,
        cluster: cluster,
      },
      user: {
        uid: 'aetherlink_user',
      },
      audio: {
        voice_type: this.config.voiceType,
        encoding: this.config.encoding || 'mp3',
        speed_ratio: this.config.speed ?? 1.0,
        volume_ratio: this.config.volume ?? 1.0,
        pitch_ratio: this.config.pitch ?? 1.0,
      },
      request: {
        reqid: this.generateRequestId(),
        text: text,
        text_type: 'plain',
        operation: 'query',
      },
    };
    
    // 添加情感参数（如果设置）
    if (this.config.emotion) {
      (request.audio as Record<string, unknown>).emotion = this.config.emotion;
    }
    
    return request;
  }
  
  /**
   * 生成请求 ID
   */
  private generateRequestId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  /**
   * Base64 转 ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
  
  /**
   * 获取 MIME 类型
   */
  private getMimeType(): string {
    switch (this.config.encoding) {
      case 'mp3':
        return 'audio/mpeg';
      case 'ogg_opus':
        return 'audio/ogg';
      case 'wav':
        return 'audio/wav';
      case 'pcm':
        return 'audio/pcm';
      default:
        return 'audio/mpeg';
    }
  }
  
  /**
   * 获取当前配置
   */
  getConfig(): VolcanoTTSConfig {
    return { ...this.config };
  }
}
