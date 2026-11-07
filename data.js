/* 学习陪伴 · 内置内容库
 * 外研社2024新版五年级上册英语词库（孙有中主编） / 数学题库 / 知识点讲解库 / 作业模板
 * 全部为纯数据，家长可在应用内自行扩充
 */
window.SB_DATA = (function () {
  const wordUnits = [
    { id: 'u1', book: 'wy2024', grade: 5, term: 1, name: '五上 U1 · What\'s on your plate?（餐盘与饮食）', words: [
        { w: 'plate', zh: '盘子，碟子', tip: 'p-l-a-t-e，结尾 e 不发音，a 发 /eɪ/' },
        { w: 'group', zh: '群体', tip: 'g-r-o-u-p，ou 发 /uː/' },
        { w: 'food group', zh: '食物类别', tip: '两个词：食物 food + 类别 group' },
        { w: 'fruit', zh: '水果', tip: 'f-r-u-i-t，ui 发 /uː/' },
        { w: 'candy', zh: '糖果', tip: 'c-a-n-d-y，结尾是 dy' },
        { w: 'chocolate', zh: '巧克力', tip: 'cho + co + late，中间的 o 别丢' },
        { w: 'cola', zh: '可乐', tip: 'c-o-l-a，两个 o 音：co-la' },
        { w: 'chips', zh: '炸薯条', tip: 'chip 加 s，ch 发 /tʃ/' },
        { w: 'soup', zh: '汤', tip: 's-o-u-p，ou 发 /uː/' },
        { w: 'potato', zh: '土豆', tip: 'po + ta + to，三个音节，单数结尾是 o' },
        { w: 'choose', zh: '挑选，选择', tip: 'choo + se，双 o 发 /uː/' },
        { w: 'meat', zh: '肉', tip: 'm-e-a-t，ea 发 /iː/，和 meet 同音' },
        { w: 'letter', zh: '信，函', tip: 'l-e-tt-e-r，双写 t' },
        { w: 'stomach', zh: '胃', tip: 'sto + mach，ch 发 /k/，比较特殊' },
        { w: 'enough', zh: '足够', tip: 'e-nough，ough 发 /ʌf/，特殊拼写' },
        { w: 'that\'s enough', zh: '够了', tip: 'that is 的缩略 that’s + enough' },
        { w: 'bad', zh: '不好的，坏的', tip: 'b-a-d，a 发 /æ/' },
        { w: 'bread', zh: '面包', tip: 'b-r-ea-d，ea 发 /e/ 短音' },
        { w: 'a few', zh: '一些，几个', tip: 'a + few，后接可数名词复数' },
        { w: 'biscuit', zh: '饼干', tip: 'bis + cuit，ui 不发音' },
        { w: 'heavy', zh: '沉重的', tip: 'heav + y，ea 发 /e/' },
        { w: 'sleepy', zh: '困倦的', tip: 'sleep + y，双写 e' },
        { w: 'always', zh: '总是，一直', tip: 'al + ways，结尾是 ways' },
        { w: 'change', zh: '变化，改变', tip: 'ch-an-ge，结尾 ge 发 /dʒ/' },
        { w: 'healthy', zh: '健康的', tip: 'health + y，ea 发 /e/' },
        { w: 'problem', zh: '问题，难题', tip: 'pro + blem，中间是 ble' },
        { w: 'slow', zh: '缓慢的', tip: 's-l-ow，ow 发 /əʊ/' },
        { w: 'whoa', zh: '冷静，慢些', tip: 'w-h-o-a，表示让马放慢的口令' },
        { w: 'oats', zh: '燕麦', tip: 'oat 加 s，oa 发 /əʊ/' },
        { w: 'nut', zh: '坚果，果仁', tip: 'n-u-t，三个字母，u 发 /ʌ/' },
        { w: 'bar', zh: '块，条，棒', tip: 'b-a-r，一条巧克力就是 a bar of chocolate' },
        { w: 'teaspoon', zh: '茶匙', tip: 'tea + spoon，茶匙=喝茶的勺' },
        { w: 'sugar', zh: '糖', tip: 'su + gar，开头 su 发 /ʃʊ/' },
        { w: 'bottle', zh: '瓶子', tip: 'b-o-tt-l-e，双写 t' },
        { w: 'oil', zh: '油', tip: 'o-i-l，三个字母，oi 发 /ɔɪ/' },
        { w: 'snack', zh: '小吃，点心', tip: 's-n-a-ck，结尾 ck' }
      ]
    },
    { id: 'u2', book: 'wy2024', grade: 5, term: 1, name: '五上 U2 · A green life（绿色生活）', words: [
        { w: 'waste', zh: '浪费；废弃物', tip: 'w-a-s-t-e，a 发 /eɪ/' },
        { w: 'plastic', zh: '塑料；塑料制的', tip: 'pla + stic，结尾是 tic' },
        { w: 'throw', zh: '扔', tip: 'th-r-ow，ow 发 /əʊ/' },
        { w: 'useful', zh: '有用的', tip: 'use + ful，词尾只有一个 l' },
        { w: 'Yours', zh: '你真挚的（书信结尾）', tip: 'Your + s，写信落款常用 Yours' },
        { w: 'recycle', zh: '回收利用', tip: 're + cycle，re 表示再，cycle 是循环' },
        { w: 'each', zh: '每个，各', tip: 'e-a-ch，ea 发 /iː/' },
        { w: 'over', zh: '超过，多于', tip: 'o + ver，o 发 /əʊ/' },
        { w: 'metal', zh: '金属', tip: 'm-e-ta-l，结尾是 tal' },
        { w: 'into', zh: '进入，到…里', tip: 'in + to，一个词' },
        { w: 'turn into', zh: '变成', tip: 'turn + into，turn 是转变' },
        { w: 'newspaper', zh: '报纸', tip: 'news + paper，新闻纸' },
        { w: 'flat', zh: '平的', tip: 'f-l-a-t，a 发 /æ/' },
        { w: 'beginning', zh: '开始，开端', tip: 'begin 双写 n 再加 ing' },
        { w: 'off', zh: '离开，移开', tip: 'o-ff，双写 f' },
        { w: 'take off', zh: '拿掉，移去', tip: 'take + off，也指飞机起飞' },
        { w: 'seat', zh: '座位', tip: 's-ea-t，ea 发 /iː/' },
        { w: 'land', zh: '陆地；降落', tip: 'l-a-n-d，和手 hand 差一个字母' },
        { w: 'shop', zh: '商店；购物', tip: 'sh-o-p，o 发 /ɒ/ 短音' }
      ]
    },
    { id: 'u3', book: 'wy2024', grade: 5, term: 1, name: '五上 U3 · Happy together（快乐在一起）', words: [
        { w: 'friendship', zh: '友谊', tip: 'friend + ship，朋友之间的小船' },
        { w: 'unhappy', zh: '不开心的', tip: 'un + happy，加 un 变反义' },
        { w: 'both', zh: '两个都', tip: 'b-o-th，结尾 th' },
        { w: 'funny', zh: '有趣的', tip: 'fun 双写 n 加 y' },
        { w: 'musical', zh: '擅长音乐的', tip: 'music + al，结尾是 cal' },
        { w: 'difference', zh: '差别，差异', tip: 'differ + ence，双写 f' },
        { w: 'er', zh: '喂，哦（语气词）', tip: 'e-r，两个字母，说话犹豫时的语气' },
        { w: 'rabbit', zh: '兔子', tip: 'ra + bbit，双写 b' },
        { w: 'key', zh: '关键；钥匙', tip: 'k-e-y，ey 发 /iː/' },
        { w: 'parent', zh: '父亲或母亲', tip: 'pa + rent，指父母中的一方' },
        { w: 'tip', zh: '窍门，建议', tip: 't-i-p，三个字母' },
        { w: 'similar', zh: '相似的', tip: 'sim + ilar，和 same 意思近' },
        { w: 'plan', zh: '计划', tip: 'p-l-a-n，双写 n 再加 ning 变 planning' },
        { w: 'openly', zh: '坦诚地', tip: 'open + ly，结尾是 ly' }
      ]
    },
    { id: 'u4', book: 'wy2024', grade: 5, term: 1, name: '五上 U4 · A better me（更好的自己）', words: [
        { w: 'goal', zh: '目标，目的', tip: 'g-oa-l，oa 发 /əʊ/，也指进球' },
        { w: 'drink', zh: '喝；饮料', tip: 'd-r-i-nk，结尾 nk' },
        { w: 'healthily', zh: '健康地', tip: 'health + ily，由 healthy 变来' },
        { w: 'exercise', zh: '运动，锻炼', tip: 'exer + cise，结尾是 cise' },
        { w: 'survey', zh: '调查', tip: 'sur + vey，ur 发 /ɜː/' },
        { w: 'top', zh: '最高的；顶部', tip: 't-o-p，三个字母' },
        { w: 'test', zh: '测验，测试', tip: 't-e-s-t，结尾 st' },
        { w: 'October', zh: '十月', tip: 'Oc + tober，首字母永远大写' },
        { w: 'complete', zh: '使完整', tip: 'com + plete，结尾是 plete' },
        { w: 'sentence', zh: '句子', tip: 'sen + tence，结尾是 tence' },
        { w: 'November', zh: '十一月', tip: 'No + vember，首字母大写' },
        { w: 'match', zh: '比赛', tip: 'm-a-tch，结尾 tch 发 /tʃ/' },
        { w: 'late', zh: '迟到的', tip: 'l-a-t-e，a 发 /eɪ/' },
        { w: 'be late for school', zh: '上学迟到', tip: '固定搭配 be late for + 名词' },
        { w: 'before', zh: '在……以前', tip: 'be + fore，和 after 是反义' },
        { w: 'sell', zh: '卖，出售', tip: 's-e-ll，双写 l，和 buy 相反' },
        { w: 'buy', zh: '买，购买', tip: 'b-u-y，三个字母，u 发 /aɪ/' },
        { w: 'medicine', zh: '药', tip: 'medi + cine，结尾是 cine' },
        { w: 'hurry', zh: '赶紧，匆忙', tip: 'hur + ry，双写 r' },
        { w: 'classroom', zh: '教室，课堂', tip: 'class + room，一个词' },
        { w: 'afraid', zh: '害怕的', tip: 'af + raid，ai 发 /eɪ/' },
        { w: 'set', zh: '创造（纪录）；放置', tip: 's-e-t，set a record 创纪录' },
        { w: 'record', zh: '纪录；记录', tip: 're + cord，名词重音在前' },
        { w: 'metre', zh: '米', tip: 'm-e-tre，英式拼写结尾是 tre' }
      ]
    },
    { id: 'u5', book: 'wy2024', grade: 5, term: 1, name: '五上 U5 · Look into the future（展望未来）', words: [
        { w: 'future', zh: '将来，未来', tip: 'fu + ture，结尾是 ture' },
        { w: 'drive', zh: '开车，驾驶', tip: 'd-r-i-v-e，i 发 /aɪ/' },
        { w: 'pet', zh: '宠物', tip: 'p-e-t，三个字母' },
        { w: 'space', zh: '太空；空间', tip: 's-p-a-ce，a 发 /eɪ/' },
        { w: 'danger', zh: '危险', tip: 'dan + ger，a 发 /eɪ/' },
        { w: 'glass', zh: '玻璃；玻璃杯', tip: 'g-l-a-ss，双写 s' },
        { w: 'celebrate', zh: '庆祝', tip: 'cele + brate，三段音节' },
        { w: 'hundred', zh: '一百', tip: 'hun + dred，中间是 dre' },
        { w: 'pie', zh: '馅饼，派', tip: 'p-i-e，ie 发 /aɪ/' },
        { w: 'fries', zh: '炸薯条', tip: 'fry 的复数 fries，ies 发 /aɪz/' },
        { w: 'bright', zh: '明亮的', tip: 'b-r-ight，igh 发 /aɪ/' },
        { w: 'shape', zh: '形状', tip: 'sh-a-pe，a 发 /eɪ/' },
        { w: 'pill', zh: '药丸，药片', tip: 'p-i-ll，双写 l' }
      ]
    },
    { id: 'u6', book: 'wy2024', grade: 5, term: 1, name: '五上 U6 · Enjoy the festivals（欢乐节日）', words: [
        { w: 'mooncake', zh: '月饼', tip: 'moon + cake，月亮蛋糕' },
        { w: 'September', zh: '九月', tip: 'Sep + tember，首字母大写' },
        { w: 'zookeeper', zh: '动物园饲养员', tip: 'zoo + keeper，zoo 加 keep 加 er' },
        { w: 'candle', zh: '蜡烛', tip: 'can + dle，结尾是 dle' },
        { w: 'merry', zh: '快乐的', tip: 'mer + ry，双写 r' },
        { w: 'Merry Christmas', zh: '圣诞快乐', tip: 'Merry + Christmas，两个词首字母都大写' },
        { w: 'celebration', zh: '庆祝，庆祝活动', tip: 'celebrate 去 e 加 ion' },
        { w: 'bell', zh: '钟，铃', tip: 'b-e-ll，双写 l' }
      ]
    },
    /* ---------- 上海版（沪教牛津 · 2024 新版）四年级上册 ---------- */
    { id: 'sh1', book: 'sh2024', grade: 4, term: 1, name: '四上 U1 · 我们的学校（校园场所）', words: [
        { w: 'classroom', zh: '教室', tip: 'class + room，两个词拼在一起' },
        { w: 'sports field', zh: '运动场', tip: 'sports + field，运动 + 场地' },
        { w: 'hall', zh: '礼堂', tip: 'h-a-l-l，两个 l 结尾' },
        { w: 'begin', zh: '开始', tip: 'be + gin，i 发 /ɪ/' },
        { w: 'project', zh: '学校的课题；项目', tip: 'pro + ject，j 开头' },
        { w: 'computer room', zh: '计算机机房', tip: 'computer + room，两个词' },
        { w: 'let', zh: '允许；让', tip: 'l-e-t，三个字母' },
        { w: 'bamboo', zh: '竹子', tip: 'bam + boo，两个 b' },
        { w: 'school building', zh: '教学楼', tip: 'building 里 u 发短音 /ɪ/' },
        { w: 'tall', zh: '高大的', tip: 't-a-l-l，双写 l' },
        { w: 'student', zh: '学生', tip: 'stu + dent，u 发 /juː/' },
        { w: 'art room', zh: '美术教室', tip: 'art + room，美术 + 房间' },
        { w: 'keep tidy', zh: '保持整洁', tip: 'keep ... tidy 中间可以加名词' }
      ]},
    { id: 'sh2', book: 'sh2024', grade: 4, term: 1, name: '四上 U2 · 喜好与鼓励', words: [
        { w: 'lovely', zh: '令人愉快的；可爱的', tip: 'love + ly，e 去掉加 ly' },
        { w: 'great', zh: '好极的；使人快乐的', tip: 'g-r-ea-t，ea 发 /eɪ/' },
        { w: 'often', zh: '时常', tip: 'o-ften，t 不发音' },
        { w: 'always', zh: '总是', tip: 'al + ways，结尾是 ways' },
        { w: 'interesting', zh: '有趣的', tip: 'interest + ing，三音节' },
        { w: 'helpful', zh: '愿意帮忙的', tip: 'help + ful，后缀 ful' },
        { w: 'English', zh: '英语', tip: 'E 大写，Eng + lish' },
        { w: 'duck', zh: '躲闪；鸭子', tip: 'd-u-ck，ck 结尾' },
        { w: 'let me try', zh: '让我试试', tip: 'try 里 y 发 /aɪ/' },
        { w: 'take it easy', zh: '放轻松', tip: 'easy 里 ea 发 /iː/' },
        { w: 'keep going', zh: '继续下去', tip: 'going 是 go + ing' }
      ]},
    { id: 'sh3', book: 'sh2024', grade: 4, term: 1, name: '四上 U3 · 动物（颜色与家乡）', words: [
        { w: 'panda', zh: '大熊猫', tip: 'pan + da，a 发 /æ/' },
        { w: 'black', zh: '黑的；黑色的', tip: 'b-l-a-ck，ck 结尾' },
        { w: 'white', zh: '白的；白色的', tip: 'wh + ite，i 发 /aɪ/' },
        { w: 'hometown', zh: '家乡', tip: 'home + town，两个词合成' },
        { w: 'monkey', zh: '猴子', tip: 'mon + key，和 donkey 像兄弟' },
        { w: 'yellow', zh: '黄的；黄色的', tip: 'yel + low，双写 l' },
        { w: 'elephant', zh: '象', tip: 'e + le + phant，ph 发 /f/' },
        { w: 'grey', zh: '灰色的', tip: 'g-r-e-y，ey 发 /eɪ/' },
        { w: 'trunk', zh: '象鼻', tip: 'tr + un + k，u 发 /ʌ/' },
        { w: 'family', zh: '家庭', tip: 'fa + mi + ly，注意是 mi 不是 me' },
        { w: 'India', zh: '印度', tip: 'In + dia，I 大写（国家名）' },
        { w: 'Africa', zh: '非洲', tip: 'Af + ri + ca，A 大写' },
        { w: 'baby elephant', zh: '小象', tip: 'baby + elephant，小 + 象' },
        { w: 'tail', zh: '尾巴', tip: 't-ai-l，ai 发 /eɪ/' },
        { w: 'kind', zh: '友好的；种类', tip: 'k-i-nd，i 发 /aɪ/' },
        { w: 'polar bear', zh: '北极熊', tip: 'polar + bear，bear 是熊' },
        { w: 'the North Pole', zh: '北极', tip: '两个词都要大写' },
        { w: 'warm', zh: '温暖的', tip: 'w-ar-m，ar 发 /ɔː/' }
      ]},
    { id: 'sh4', book: 'sh2024', grade: 4, term: 1, name: '四上 U4 · 聚会与庆祝', words: [
        { w: 'invitation', zh: '邀请', tip: 'invi + tation，t-io-n 结尾' },
        { w: 'party', zh: '聚会；联欢会', tip: 'par + ty，y 发 /i/' },
        { w: 'activity', zh: '活动', tip: 'act + ivity，复数变 ies' },
        { w: 'share a cake', zh: '分享蛋糕', tip: 'share 里 are 发 /eə/' },
        { w: 'bring', zh: '带来', tip: 'b-r-i-ng，i 发 /ɪ/' },
        { w: 'letter', zh: '信；函', tip: 'l-e-tt-e-r，双写 t' },
        { w: 'child', zh: '儿童', tip: '复数很特别：children' },
        { w: 'tradition', zh: '传统', tip: 'tra + di + tion，ti 发 /ʃ/' },
        { w: 'love', zh: '爱；热爱', tip: 'l-o-v-e，结尾 e 不发音' },
        { w: 'bowl', zh: '碗', tip: 'b-ow-l，ow 发 /əʊ/' },
        { w: 'egg', zh: '鸡蛋', tip: 'e-gg，双写 g' },
        { w: 'wish', zh: '祝愿', tip: 'w-i-sh，sh 结尾' },
        { w: 'soup', zh: '汤；羹', tip: 's-ou-p，ou 发 /uː/' }
      ]},
    { id: 'sh5', book: 'sh2024', grade: 4, term: 1, name: '四上 U5 · 街区与场所', words: [
        { w: 'neighbourhood', zh: '街区', tip: 'neigh + bour + hood，很长但好拆' },
        { w: 'park', zh: '公园', tip: 'p-ar-k，ar 发 /ɑː/' },
        { w: 'shop', zh: '商店', tip: 'sh + op，复数直接加 s' },
        { w: 'cinema', zh: '电影院', tip: 'ci + ne + ma，c 发 /s/' },
        { w: 'supermarket', zh: '超市', tip: 'super + market，两个词合成' },
        { w: 'go around', zh: '参观（附近某处）', tip: 'around 里 ou 发 /ə/' },
        { w: 'boat', zh: '小船', tip: 'b-oa-t，oa 发 /əʊ/' },
        { w: 'bridge', zh: '桥', tip: 'br + idge，dge 发 /dʒ/' },
        { w: 'photo', zh: '照片', tip: 'pho + to，ph 发 /f/' },
        { w: 'amazing', zh: '令人大为惊奇的', tip: 'a + maz + ing，z 很显眼' },
        { w: 'out of battery', zh: '没电', tip: 'battery 三音节：bat-te-ry' },
        { w: 'people', zh: '人', tip: 'peo + ple，eo 发 /iː/' },
        { w: 'restaurant', zh: '餐馆', tip: 'restau + rant，au 发 /ə/' }
      ]},
    { id: 'sh6', book: 'sh2024', grade: 4, term: 1, name: '四上 U6 · 秋天与农场', words: [
        { w: 'autumn', zh: '秋天', tip: 'au + tumn，n 前有个不发音的 mn' },
        { w: 'farm', zh: '农场', tip: 'f-ar-m，ar 发 /ɑː/' },
        { w: 'boy', zh: '男孩', tip: 'b-o-y，oy 发 /ɔɪ/' },
        { w: 'fruit', zh: '水果', tip: 'f-r-ui-t，ui 发 /uː/' },
        { w: 'fly south', zh: '往南飞', tip: 'south 里 ou 发 /aʊ/' },
        { w: 'girl', zh: '女孩', tip: 'g-i-r-l，ir 发 /ɜː/' },
        { w: 'golden', zh: '金色的', tip: 'gold + en，后缀 en' },
        { w: 'apple', zh: '苹果', tip: 'a + pple，双写 p' },
        { w: 'worker', zh: '工作者', tip: 'work + er，职业后缀 er' },
        { w: 'quick', zh: '快的', tip: 'q-u-ck，qu 发 /kw/' }
      ]},
    { id: 'sh7', book: 'sh2024', grade: 4, term: 1, name: '四上 U7 · 早餐与食物', words: [
        { w: 'breakfast', zh: '早餐', tip: 'break + fast，合成词' },
        { w: 'menu', zh: '菜单', tip: 'me + nu，u 发 /juː/' },
        { w: 'juice', zh: '果汁', tip: 'j-ui-ce，ui 发 /uː/' },
        { w: 'milk', zh: '奶', tip: 'm-i-l-k，i 发 /ɪ/' },
        { w: 'soya milk', zh: '豆浆', tip: 'soya + milk，豆 + 奶' },
        { w: 'banana', zh: '香蕉', tip: 'ba + na + na，三个 a 读音不同' },
        { w: 'week', zh: '周；星期', tip: 'w-ee-k，ee 发 /iː/' },
        { w: 'eat', zh: '吃', tip: 'e-a-t，ea 发 /iː/' },
        { w: 'tomorrow', zh: '明天', tip: 'to + mor + row，双写 r 前后各一个 o' },
        { w: 'energy', zh: '能量', tip: 'e + ner + gy，y 结尾发 /i/' },
        { w: 'protein', zh: '蛋白质', tip: 'pro + tein，ei 发 /iː/' },
        { w: 'vitamin', zh: '维生素', tip: 'vi + ta + min，三音节' },
        { w: 'cry', zh: '喊叫；哭', tip: 'c-r-y，y 发 /aɪ/' }
      ]},
    { id: 'sh8', book: 'sh2024', grade: 4, term: 1, name: '四上 U8 · 诚实守信', words: [
        { w: 'keep ones word', zh: '遵守诺言', tip: 'keep + ones + word，说到做到' },
        { w: 'give back', zh: '归还', tip: 'give ... back，中间可加东西' },
        { w: 'on time', zh: '准时', tip: 'on + time，固定搭配' },
        { w: 'honest', zh: '诚实的', tip: 'h 不发音！读作 /ˈɒnɪst/' },
        { w: 'tell the truth', zh: '说真话', tip: 'truth 里 tr 发 /tr/' },
        { w: 'never tell a lie', zh: '从不撒谎', tip: 'lie 里 ie 发 /aɪ/' },
        { w: 'stop', zh: '停止；停下', tip: 's-t-o-p，进行时双写 p' },
        { w: 'doll', zh: '玩偶；玩具娃娃', tip: 'd-o-l-l，双写 l' },
        { w: 'break', zh: '打碎；打破', tip: 'b-r-ea-k，ea 发 /eɪ/' },
        { w: 'arm', zh: '手臂', tip: 'a-r-m，ar 发 /ɑː/' },
        { w: 'empty', zh: '空的', tip: 'em + pt + y，pt 连在一起' },
        { w: 'pot', zh: '罐；壶；锅', tip: 'p-o-t，三个字母' },
        { w: 'seed', zh: '种子', tip: 's-ee-d，ee 发 /iː/' },
        { w: 'month', zh: '月份', tip: 'm-on-th，th 发 /θ/' }
      ]},
    { id: 'sh9', book: 'sh2024', grade: 4, term: 1, name: '四上 U9 · 时间', words: [
        { w: 'time', zh: '时间', tip: 't-i-m-e，i 发 /aɪ/' },
        { w: 'hour hand', zh: '时针', tip: 'hour 里 h 不发音' },
        { w: 'minute hand', zh: '分针', tip: 'minute 里 u 发 /ɪ/' },
        { w: 'seven oclock', zh: '七点钟', tip: 'oclock = o + clock 的缩写' },
        { w: 'half past eleven', zh: '十一点半', tip: 'half 里 l 不发音' },
        { w: 'ten to four', zh: '三点五十分', tip: 'to 表示「差几分到几点」' },
        { w: 'evening', zh: '晚上；傍晚', tip: 'eve + ning，e 开头' },
        { w: 'the Earth', zh: '地球', tip: 'Ea 发 /ɜː/，要大写' },
        { w: 'the moon', zh: '月球', tip: '双 o 发 /uː/' },
        { w: 'night', zh: '夜；夜晚', tip: 'n-igh-t，igh 发 /aɪ/' }
      ]},
    { id: 'sh10', book: 'sh2024', grade: 4, term: 1, name: '四上 U10 · 天气', words: [
        { w: 'father', zh: '父亲；爸爸', tip: 'fa + ther，th 发 /ð/' },
        { w: 'sunny', zh: '阳光充足的', tip: 'sun + ny，n 双写' },
        { w: 'rainy', zh: '多雨的', tip: 'rain + y，直接加 y' },
        { w: 'cloudy', zh: '阴天的；多云的', tip: 'cloud + y，ou 发 /aʊ/' },
        { w: 'brother', zh: '哥哥；弟弟', tip: 'bro + ther，th 发 /ð/' },
        { w: 'windy', zh: '多风的', tip: 'wind + y，i 发 /ɪ/' },
        { w: 'snowy', zh: '下雪多的', tip: 'snow + y，ow 发 /əʊ/' },
        { w: 'weather', zh: '天气；气象', tip: 'wea + ther，th 发 /ð/' },
        { w: 'weather report', zh: '气象报告', tip: 'weather + report，两个词' },
        { w: 'degree', zh: '度（温度单位）', tip: 'de + gree，ee 发 /iː/' },
        { w: 'weather reporter', zh: '天气预报员', tip: 'report + er，职业后缀' },
        { w: 'lamb', zh: '小羊', tip: 'l-a-mb，b 不发音' },
        { w: 'tortoise', zh: '陆龟', tip: 'tor + toise，oi 发 /ɔɪ/' },
        { w: 'sign', zh: '迹象；征兆', tip: 's-i-gn，g 不发音' },
        { w: 'hurry', zh: '赶快；急忙', tip: 'hu + rry，双写 r' },
        { w: 'heavy rain', zh: '大雨', tip: 'heavy 里 ea 发 /e/' }
      ]},
  ];

  const mathBank = [
    { id: 'm1', tag: 'decimal', q: '0.8 × 0.7 = ?', a: '0.56', type: 'num', unit: '',
      solution: ['先按整数算：8 × 7 = 56', '数一数两个因数一共有几位小数：0.8 一位，0.7 一位，共 2 位', '从 56 的右边起数出 2 位点上小数点 → 0.56'] },
    { id: 'm2', tag: 'decimal', q: '2.5 × 4 = ?', a: '10', type: 'num', unit: '',
      solution: ['25 × 4 = 100', '因数中共有 1 位小数，点上小数点得 10.0', '小数末尾的 0 要化简 → 10'] },
    { id: 'm3', tag: 'decimal', q: '7.2 ÷ 0.9 = ?', a: '8', type: 'num', unit: '',
      solution: ['除数 0.9 变成整数，小数点向右移 1 位', '被除数也同时向右移 1 位：7.2 → 72', '72 ÷ 9 = 8'] },
    { id: 'm4', tag: 'decimal', q: '3.6 ÷ 4 = ?', a: '0.9', type: 'num', unit: '',
      solution: ['3 比 4 小，整数部分商 0，点上小数点', '把 3.6 看成 36 个 0.1', '36 ÷ 4 = 9，所以是 9 个 0.1，即 0.9'] },
    { id: 'm5', tag: 'fraction', q: '1/2 + 1/3 = ?（结果写成分数，如 3/4）', a: '5/6', type: 'frac', unit: '',
      solution: ['分母不同，先通分：2 和 3 的最小公倍数是 6', '1/2 = 3/6，1/3 = 2/6', '3/6 + 2/6 = 5/6'] },
    { id: 'm6', tag: 'fraction', q: '3/4 - 1/6 = ?（结果写成分数，如 3/4）', a: '7/12', type: 'frac', unit: '',
      solution: ['4 和 6 的最小公倍数是 12', '3/4 = 9/12，1/6 = 2/12', '9/12 - 2/12 = 7/12'] },
    { id: 'm7', tag: 'fraction', q: '把 3/5 化成小数 = ?', a: '0.6', type: 'num', unit: '',
      solution: ['分数化小数用分子 ÷ 分母', '3 ÷ 5 = 0.6', '也可以把分母扩成 10：3/5 = 6/10 = 0.6'] },
    { id: 'm8', tag: 'equation', q: '解方程：3x + 5 = 20，x = ?', a: '5', type: 'num', unit: '',
      solution: ['两边同时减 5：3x = 15', '两边同时除以 3：x = 5', '验算：3 × 5 + 5 = 20，正确'] },
    { id: 'm9', tag: 'equation', q: '解方程：x - 2.4 = 3.6，x = ?', a: '6', type: 'num', unit: '',
      solution: ['两边同时加 2.4', 'x = 3.6 + 2.4 = 6', '验算：6 - 2.4 = 3.6，正确'] },
    { id: 'm10', tag: 'area', q: '平行四边形的底 6 cm、高 4 cm，面积是多少 cm²？（只填数字）', a: '24', type: 'num', unit: 'cm²',
      solution: ['平行四边形面积 = 底 × 高', 'S = 6 × 4 = 24', '单位是平方厘米 cm²'] },
    { id: 'm11', tag: 'area', q: '三角形的底 8 cm、高 5 cm，面积是多少 cm²？（只填数字）', a: '20', type: 'num', unit: 'cm²',
      solution: ['三角形面积 = 底 × 高 ÷ 2', '8 × 5 = 40', '40 ÷ 2 = 20 cm²（别忘了除以 2）'] },
    { id: 'm12', tag: 'area', q: '梯形上底 3 cm、下底 7 cm、高 4 cm，面积是多少 cm²？（只填数字）', a: '20', type: 'num', unit: 'cm²',
      solution: ['梯形面积 = (上底 + 下底) × 高 ÷ 2', '(3 + 7) × 4 = 40', '40 ÷ 2 = 20 cm²'] },
    { id: 'm13', tag: 'volume', q: '长方体长 5 cm、宽 3 cm、高 2 cm，体积是多少 cm³？（只填数字）', a: '30', type: 'num', unit: 'cm³',
      solution: ['长方体体积 = 长 × 宽 × 高', 'V = 5 × 3 × 2 = 30', '单位是立方厘米 cm³'] },
    { id: 'm14', tag: 'volume', q: '3.5 平方米 = 多少平方分米？（只填数字）', a: '350', type: 'num', unit: 'dm²',
      solution: ['1 平方米 = 100 平方分米（面积单位进率是 100）', '3.5 × 100 = 350', '注意不是乘 10，那是长度单位'] },
    { id: 'm15', tag: 'mixed', q: '12.5 × 8 + 25 × 4 = ?', a: '200', type: 'num', unit: '',
      solution: ['先算两级乘法：12.5 × 8 = 100', '25 × 4 = 100', '再相加：100 + 100 = 200'] },
    { id: 'm16', tag: 'mixed', q: '(18 - 6) ÷ 3 + 7 = ?', a: '11', type: 'num', unit: '',
      solution: ['先算括号：18 - 6 = 12', '再算除法：12 ÷ 3 = 4', '最后加法：4 + 7 = 11'] },
    { id: 'm17', tag: 'word', q: '一支笔 3.5 元，买 4 支，付 20 元，应找回多少元？（只填数字）', a: '6', type: 'num', unit: '元',
      solution: ['先算花了多少：3.5 × 4 = 14 元', '再算找回：20 - 14 = 6 元', '应用题要写单位和答语'] },
    { id: 'm18', tag: 'word', q: '长方形花坛长 12 米、宽 8 米，沿边走一圈是多少米？（只填数字）', a: '40', type: 'num', unit: '米',
      solution: ['走一圈求的是周长，不是面积', '周长 = (长 + 宽) × 2 = (12 + 8) × 2', '20 × 2 = 40 米'] },
    { id: 'm19', tag: 'number', q: '24 和 36 的最大公因数是多少？（只填数字）', a: '12', type: 'num', unit: '',
      solution: ['24 的因数：1,2,3,4,6,8,12,24', '36 的因数：1,2,3,4,6,9,12,18,36', '公有因数里最大的是 12'] },
    { id: 'm20', tag: 'number', q: '四次数学成绩 88、92、95、85，平均分是多少？（只填数字）', a: '90', type: 'num', unit: '分',
      solution: ['先求总分：88 + 92 + 95 + 85 = 360', '平均分 = 总分 ÷ 次数', '360 ÷ 4 = 90 分'] },
    { id: 'm21', tag: 'number', q: '20 米的小路每 5 米栽一棵树，两端都栽，共栽多少棵？（只填数字）', a: '5', type: 'num', unit: '棵',
      solution: ['先算间隔数：20 ÷ 5 = 4 个间隔', '两端都栽时，棵数 = 间隔数 + 1', '4 + 1 = 5 棵'] },
    { id: 'm22', tag: 'decimal', q: '1.25 × 8 = ?', a: '10', type: 'num', unit: '',
      solution: ['125 × 8 = 1000', '因数中共有 2 位小数 → 10.00', '化简得 10'] }
  ];

  const lessons = {
    decimal: {
      title: '小数乘除法',
      points: ['小数乘法先按整数乘，再数小数位数点小数点', '小数除法先把除数变成整数，被除数的小数点要同步移动', '积或商末尾的 0 要化简'],
      steps: ['① 忽略小数点，按整数算出结果', '② 数清因数（或被除数、除数）里一共有几位小数', '③ 从结果右边起数出相应位数，点上小数点', '④ 代入原式验算一次量级是否合理'],
      pitfalls: ['最容易漏数小数位数，或把小数点方向点反', '除数是小数时，只移动除数、忘记同步移动被除数', '结果末尾的 0 要化简，比如 10.00 写成 10'],
      similar: [{ q: '0.6 × 0.5 = ?', a: '0.3' }, { q: '4.8 ÷ 0.6 = ?', a: '8' }]
    },
    fraction: {
      title: '分数加减与互化',
      points: ['分母不同要先通分，分母相同才能直接加减', '通分用两个分母的最小公倍数最省事', '分数化小数用分子 ÷ 分母；结果能约分要约成最简分数'],
      steps: ['① 看分母是否相同', '② 不同则找最小公倍数，把两个分数都化成同分母', '③ 分子相加减，分母保持不变', '④ 检查是否需要约分'],
      pitfalls: ['把分子和分母分别相加（1/2 + 1/3 错算成 2/5）', '通分后忘记把分子也跟着扩大', '结果没化成最简分数'],
      similar: [{ q: '1/4 + 1/2 = ?（写成分数）', a: '3/4' }, { q: '5/6 - 1/3 = ?（写成分数）', a: '1/2' }]
    },
    equation: {
      title: '简易方程',
      points: ['等式两边同时做同样的运算，等式仍然成立', '目标是让 x 单独留在等号一边', '解完一定要代入验算'],
      steps: ['① 先把含 x 的项留在一边，常数项移到另一边（移项要变号）', '② 合并同类项', '③ 两边同时除以 x 的系数，求出 x', '④ 把 x 代回原方程验算'],
      pitfalls: ['移项忘了变号', '3x = 15 时误算成 x = 15 - 3', '忘记写"解："，格式扣分'],
      similar: [{ q: '2x + 6 = 18，x = ?', a: '6' }, { q: 'x + 4.5 = 10，x = ?', a: '5.5' }]
    },
    area: {
      title: '平面图形面积',
      points: ['平行四边形：S = 底 × 高', '三角形：S = 底 × 高 ÷ 2', '梯形：S = (上底 + 下底) × 高 ÷ 2', '高必须是与底垂直的那条线段'],
      steps: ['① 判断图形，写出对应公式', '② 找出底和高（注意单位是否统一）', '③ 代入计算，三角形和梯形记得除以 2', '④ 写上平方单位'],
      pitfalls: ['三角形、梯形漏掉"÷ 2"', '把斜边当作高', '面积单位写成 cm 而不是 cm²'],
      similar: [{ q: '三角形底 6 cm、高 4 cm，面积？（只填数字）', a: '12' }, { q: '平行四边形底 9 cm、高 3 cm，面积？（只填数字）', a: '27' }]
    },
    volume: {
      title: '体积与单位换算',
      points: ['长方体体积 = 长 × 宽 × 高', '长度单位进率 10，面积进率 100，体积进率 1000', '大单位换小单位乘进率，小单位换大单位除以进率'],
      steps: ['① 确认是长度、面积还是体积单位', '② 选对进率：10 / 100 / 1000', '③ 大化小用乘法，小化大用除法', '④ 检查小数点的位置'],
      pitfalls: ['面积换算误用进率 10', '3.5 m² 错算成 35 dm²', '体积用了平方厘米'],
      similar: [{ q: '2 平方米 = 多少平方分米？（只填数字）', a: '200' }, { q: '长 4、宽 2、高 3 的长方体体积？（只填数字）', a: '24' }]
    },
    mixed: {
      title: '四则混合运算',
      points: ['有括号先算括号里面', '没有括号：先乘除、后加减', '同级运算从左往右依次算'],
      steps: ['① 圈出括号，先算括号内的', '② 找出所有乘除法先算掉', '③ 再算加减', '④ 每算一步把结果写下来，避免心算跳步'],
      pitfalls: ['看见 12.5 × 8 就想先算前面的加减', '同级运算跳着算', '抄错数字或符号'],
      similar: [{ q: '25 × 4 + 18 ÷ 2 = ?', a: '109' }, { q: '(20 - 8) × 3 = ?', a: '36' }]
    },
    word: {
      title: '应用题',
      points: ['先读清楚问的是什么（面积？周长？找回多少钱？）', '把已知条件一条条列出来', '分步列式比一步心算更不容易错'],
      steps: ['① 圈出问题和关键词', '② 列出已知量，统一单位', '③ 想清楚先求什么、再求什么', '④ 分步列式计算，最后写单位和答语'],
      pitfalls: ['"绕一圈"看成求面积', '漏写单位或答语', '中间结果四舍五入导致最后答案偏差'],
      similar: [{ q: '每本 6.5 元，买 3 本付 30 元，找回多少元？（只填数字）', a: '10.5' }, { q: '正方形边长 7 cm，周长多少 cm？（只填数字）', a: '28' }]
    },
    number: {
      title: '因数倍数、平均数与植树问题',
      points: ['最大公因数：先分别列因数，再找公有且最大的', '平均数 = 总数 ÷ 份数', '两端都栽：棵数 = 间隔数 + 1；只栽一端：棵数 = 间隔数'],
      steps: ['① 判断题目属于哪一类', '② 把数量关系写成一句公式', '③ 代入数字，分步计算', '④ 回头看问题问的是"棵数"还是"间隔数"'],
      pitfalls: ['植树问题漏加 1 或多加 1', '求平均数时除错了份数', '公因数与公倍数混淆'],
      similar: [{ q: '18 和 24 的最大公因数？（只填数字）', a: '6' }, { q: '30 米每 6 米栽一棵，两端都栽，共几棵？（只填数字）', a: '6' }]
    }
  };

  const tagNames = {
    decimal: '小数乘除', fraction: '分数', equation: '简易方程', area: '图形面积',
    volume: '体积与单位', mixed: '混合运算', word: '应用题', number: '数与运算'
  };

  const taskTemplates = [
    { subject: '语文', content: '抄写生字词 + 组词', minutes: 20 },
    { subject: '语文', content: '朗读课文并签字', minutes: 15 },
    { subject: '语文', content: '课外阅读 20 分钟', minutes: 20 },
    { subject: '语文', content: '写一篇日记 / 周记', minutes: 25 },
    { subject: '数学', content: '完成数学练习册一页', minutes: 25 },
    { subject: '数学', content: '口算 / 计算题 20 道', minutes: 15 },
    { subject: '数学', content: '订正昨天的错题', minutes: 10 },
    { subject: '英语', content: '听写本单元单词', minutes: 15 },
    { subject: '英语', content: '跟读课文录音 10 分钟', minutes: 10 },
    { subject: '英语', content: '抄写单词每个 3 遍', minutes: 15 },
    { subject: '其他', content: '整理书包、准备明天课本', minutes: 5 }
  ];


  const badges = [
    { id: 'first', name: '启程之星', desc: '完成第一次作业打卡', test: s => s.totalCheckins >= 1 },
    { id: 'streak3', name: '坚持三日', desc: '连续打卡 3 天', test: s => s.bestStreak >= 3 },
    { id: 'streak7', name: '一周不断', desc: '连续打卡 7 天', test: s => s.bestStreak >= 7 },
    { id: 'star30', name: '小星星收藏家', desc: '累计获得 30 颗星', test: s => s.totalStars >= 30 },
    { id: 'dictation', name: '听写小达人', desc: '完成 3 次英语听写', test: s => s.dictationCount >= 3 },
    { id: 'math', name: '计算小能手', desc: '完成 3 次数学练习', test: s => s.mathCount >= 3 },
    { id: 'mastered', name: '错题克星', desc: '把 5 道错题标记为已掌握', test: s => s.masteredCount >= 5 }
  ];

  return { wordUnits, mathBank, lessons, tagNames, taskTemplates, badges };
})();
