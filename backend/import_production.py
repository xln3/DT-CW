"""Production import: Spring 2026 semester complete data.

Creates: members (with details), programs, teachers, rehearsals,
venues, timeslots, venue bookings, calendar events (holidays).
Self-contained — no Excel files needed.
"""
import sys
import os
from datetime import date, time, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from database import db
from models import (
    Semester, Member, User, Program, ProgramMember, UserProgram,
    Teacher, Rehearsal, Venue, VenueTimeSlot, VenueBooking,
    CalendarEvent, EventType,
)
from models.program import ProgramTeacher

# ─── Member detail data (from 全息表) ─────────────────────────────
# (name, gender, student_id, department, class_name, phone, email,
#  dormitory, birth_date, ethnicity, hometown, political_status,
#  party_branch, is_talented, is_concentrated_class, team_role,
#  join_year, team_level)
DETAILED_MEMBERS = [
('艾丽雅', '女', '2021010917', '建筑学院', '建11', '18810756469', 'aly21@mails.tsinghua.edu.cn', '紫荆5#313B', '2002-10-16', '蒙古族', '内蒙古-赤峰', '共青团员', '院系', True, True, '无', None, '一队'),
('毕玮韬', '男', '2024210046', '建筑学院', '建研242', '13897423847', 'bwt24@mails.tsinghua.edu.cn', '28#239', '2001-08-10', '汉族', '陕西-渭南', '共青团员', '院系', False, True, '无', None, '一队'),
('陈汜玄', '男', '2021311328', '物理系', '物研211', '18811392219', 'csx21@mails.tsinghua.edu.cn', '28#239', '1999-11-22', '汉族', '福建-漳平', '共青团员', '院系', False, True, '无', 2017, '一队'),
('陈煦霖', '女', '2023011563', '经管学院', '经37', '13261087689', 'chenxuli23@tsinghua.mails.edu.cn', '紫5#614B', '2005-04-11', '汉族', '江苏省张家港市', '共青团员', '院系', False, True, '队长', None, '一队'),
('谌卓凡', '男', '2023011598', '软件学院', '软32', '15222034636', 'czf23@mails.tsinghua.edu.cn', '紫荆6#523A', '2005-04-11', '汉族', '江西-南昌', '群众', '无', False, False, '宣传副队长', None, '一队'),
('程浩', '男', '2022310492', '车辆与运载学院', '车博22', '13020071911', 'chengh22@mails.tsinghua.edu.cn', '27#314', '2000-02-13', '汉族', '河南-安阳', '中共党员', '院系', False, False, '无', 2021, '一队'),
('方青帝', '女', '2019013161', '医学院', '医双9', '13811890775', 'fqd19@mails.tsinghua.edu.cn', '36#102', '2001-04-04', '汉族', '北京市', '共青团员', '院系', False, True, '无', None, '一队'),
('傅煜涵', '女', '2023011933', '美术', '美35', '13801390481', '1728978766@qq.com', '紫8 212b', '2005-04-16', '汉族', '北京', '共青团员', '无', False, False, '无', None, '一队'),
('龚蔚语', '女', '2022012659', '为先书院', '为先22', '18113123872', 'gongwy22@mails.tsinghua.edu.cn', '紫荆4#322A', '2004-05-02', '汉族', '四川-成都', '预备党员', '院系', False, False, '无', None, '一队'),
('龚晓涵', '女', '2023011985', '美术学院', '美37', '13603339888', '2707629087@qq.com', '紫8#210A', '2007-01-07', '汉族', '河北省沧州市', '共青团员', '院系', False, False, '无', None, '一队'),
('韩娅非', '女', '2024311899', '人文学院', '人文博243', '18810598698', 'hyfhyf0913@163.com', '36#105', '1999-09-13', '汉族', '山东-聊城', '中共党员', '院系', False, True, '无', None, '一队'),
('胡问十', '男', '2023312141', '人文学院', '博231', '18722950091', 'chibikk@163.com', '紫荆14#1026A', '1993-01-20', '土家族', '贵州-铜仁', '群众', '无', False, False, '无', None, '一队'),
('贺宁怡', '女', '2023210766', '电机系', '电硕231', '13693095099', 'he_ningyi@163.com', '紫33#616', '2001-06-23', '汉族', '四川省成都市', '共青团员', '院系', False, False, '无', None, '一队'),
('何烨', '男', '2023010760', '软件学院', '软32', '15378057763', 'heye23@mails.tsinghua.edu.cn', '紫荆1#405B', '2005-03-28', '汉族', '甘肃-陇南', '共青团员', '院系', False, False, '常务副队长', 2024, '一队'),
('黄崇赫', '男', '2023012263', '新雅书院', '新雅33', '18066478567', 'hch23@mails.tsinghua.edu.cn', '10北#207', '2005-11-03', '汉族', '浙江省温州市', '共青团员', '院系', False, False, '内外联副队长', None, '一队'),
('黄孝炎', '男', '2023012375', '致理书院', '致理-化学31', '13739476083', 'huang-xy23@mails.tsinghua.edu.cn', '11#503', '2005-05-31', '汉族', '四川省成都市', '共青团员', '院系', False, True, '支书', None, '一队'),
('黄子莟', '女', '2024210829', '电子工程系', '无研43', '13621399693', 'zh-huang24@mails.tsinghua.edu.cn', '紫荆5#326A', '2002-08-19', '汉族', '福建-莆田', '中共党员', '院系', False, True, '无', None, '一队'),
('赖爰恩', '女', '2022011712', '社会科学学院', '社科22', '13051186697', 'yuanen92911@gmail.com', '紫5#128B', '2003-09-11', '汉族', '中国台湾', '群众', '无', False, False, '无', None, '一队'),
('乐宸旸', '女', '2025212834', '人文学院', '人文硕253', '18789900516', 'lecy21@mails.tsinghua.edu.cn', '35#405', '2003-05-16', '汉族', '湖北省黄冈市', '预备党员', '艺术团', False, True, '辅导员', None, '一队'),
('李岱宸', '女', '2024213102', '人文学院', '中文243', '13161125589', 'DAICHENTSINGHUA@163.com', '37#412', '2000-11-25', '汉族', '北京市', '共青团员', '院系', False, False, '后勤副队长', None, '一队'),
('李婧含', '女', '2024011730', '美术学院', '美413', '13953167412', 'li-jh24@mails.tsinghua.edu.cn', '紫5#415A', '2006-06-17', '汉族', '山东省济南市', '共青团员', '院系', False, False, '宣传组员', None, '一队'),
('李俊仪', '男', '2022012533', '求真书院', '求真20', '15356251725', 'lijunyi22@mails.tsinghua.edu.cn', '紫12#301A', '2004-10-19', '汉族', '重庆市万州市', '共青团员', '院系', False, False, '无', None, '一队'),
('李清扬', '女', '2023311295', '物理系', '物研231', '18801350107', 'qy-li23@mails.tsinghua.edu.cn', '红杉公寓#317', '2000-11-07', '汉族', '新疆-克拉玛依', '中共党员', '院系', False, False, '无', None, '一队'),
('李仕萌', '男', '2024013244', '秀钟书院', '秀钟43', '18736150682', '18736150682@139.com', '紫9#409B', '2006-05-25', '汉族', '河南省周口市', '群众', '无', False, False, '一队成员', None, '一队'),
('李延昊', '男', '2021311868', '公共管理学院', '公管博21', '13883329410', 'liyanhaothu@163.com', '28#247', '1999-07-07', '汉族', '重庆市', '中共党员', '院系', False, True, '无', None, '一队'),
('廖恺玲俐', '女', '2022310195', '环境学院', '环研6', '15911017330', 'calinly@163.com', '1#510', '1993-04-14', '汉族', '湖南-郴州', '中共党员', '院系', False, False, '无', None, '一队'),
('刘凯恒', '男', '2021080120', '经管学院', '经16', '15201269307', 'liukh21@mails.tsinghua.edu.cn', '紫荆23#227B', '2002-05-05', '马来西亚', '马来西亚', '留学生', '无', False, False, '无', None, '一队'),
('刘可欣', '女', '2021311358', '物理系', '物研212', '15006800259', 'lkx21@mails.tsinghua.edu.cn', '红杉#711', '1998-08-28', '汉族', '山东-济南', '共青团员', '院系', False, False, '无', None, '一队'),
('刘牧杨', '女', '2024310554', '电子工程系', '无研41', '18900748465', 'my-liu24@mails.tsinghau.edu.cn', '30#226', '2003-01-30', '土家', '湖南省岳阳市', '中共党员', '院系', False, False, '无', None, '一队'),
('刘宇晗', '女', '2023012960', '探微书院', '化31', '18192686721', 'liuyuhan23@mails.tsinghua.edu.cn', '紫4#224A', '2005-04-11', '汉族', '陕西西安', '共青团员', '院系', False, False, '无', None, '一队'),
('刘宇恒', '男', '2020311578', '生命科学学院', '生博201', '13260276366', 'yh-liu16@outlook.com', '紫17#353', '1998-01-07', '汉族', '河北省沧州市', '共青团员', '院系', False, True, '无', None, '一队'),
('龙宁睿', '女', '2024011236', '药学院', '药4', '18811096919', 'lnr24@mails.tsinghua.edu.cn', '紫8#705B', '2006-11-07', '汉族', '湖南津市', '共青团员', '院系', False, False, '无', None, '一队'),
('鲁继元', '男', '2023012278', '新雅书院', '新雅33', '19958686831', 'lujy23@mails.tsinghua.edu.cn', '10北427', '2004-08-22', '汉族', '甘肃省天水市', '共青团员', '院系', False, False, '宣传口组员', 2023, '一队'),
('鲁良佑', '男', '2023213535', '计算机科学与技术系', '计研33', '18911648927', 'luly23@mails.tsinghua.edu.cn', '24#511', '2000-09-21', '汉族', '四川省德阳市', '共青团员', '院系', False, False, '无', None, '一队'),
('罗子靖', '男', '2024080172', '新雅书院', '新雅44', '13810570679', 'bryanloh96@gmail.com', '10北', '2005-04-28', '汉族', '马来西亚', '国际生', '无', False, False, '队员', None, '一队'),
('骆佳', '女', '2023312275', '美术学院', '美博231', '18800151862', '18800151862@163.com', '紫荆18#406', '1998-05-23', '汉族', '广东-湛江', '中共党员', '院系', False, False, '无', None, '一队'),
('马平川', '男', '2023012470', '致理书院', '致理-信计31', '13709052438', 'ympc2005@qq.com', '11#505', '2005-05-03', '土家族', '四川成都', '共青团员', '院系', False, False, '队员', None, '一队'),
('莫西卡', '女', '2024080130', '经济管理学院', '经48', '13530016431', 'Mokshikatyagi2@163.com', '紫19#1023D', '2006-07-31', '印度', '印度', '国际生', '无', False, False, '无', None, '一队'),
('倪笑予', '女', '2023012247', '新雅书院', '新雅32', '17799796797', '766843613@qq.com', '10北514', '2004-11-26', '汉族', '江苏省江都市', '预备党员', '院系', False, False, '队员', None, '一队'),
('牛宇迪', '女', '2020312504', '生物医学工程学院', '生医博一', '13681217361', 'dijoy@sina.cn', '1#349', '1998-08-03', '汉族', '陕西省蒲城县', '中共党员', '院系', False, False, '无', None, '一队'),
('潘星宇', '女', '2024210276', '能源与动力工程系', '能动硕4', '18930076259', 'xy-pan24@mails.tsinghua.edu.cn', '33#401A', '1997-09-09', '汉族', '浙江-温州', '共青团员', '院系', False, False, '无', None, '一队'),
('潘奕嘉', '女', '2024011278', '生命科学学院', '生41', '13058086750', 'angelpoon1238@gmail.com', '紫8#312A', '2006-03-08', '汉族', '香港特别行政区', '群众', '无', False, False, '宣传副队长', None, '一队'),
('彭程', '女', '2024316058', '电子工程系', '无研42', '13009997768', 'pengc24@mails.tsinghua.edu.cn', '30#104', '2002-07-28', '汉族', '黑龙江省哈尔滨市', '中共党员', '院系', False, False, '无', None, '一队'),
('彭弋航', '女', '2023012537', '日新书院', '日新33', '18310661461', '772697285@qq.com', '紫4#306B', '2004-10-19', '汉族', '福建省宁德市', '预备党员', '艺术团', False, False, '无', None, '一队'),
('任书漫', '女', '2023213300', '人文学院', '人文硕31', '13810364023', 'anna_renshuman@163.com', '37#105', '2000-05-30', '汉族', '辽宁省新民市', '预备党员', '院系', False, False, '无', 2023, '一队'),
('石一彤', '女', '2022011433', '经管学院', '经25', '13121789898', 'shi-yt22@mails.tsinghua.edu.cn', '紫荆5#405B', '2004-08-08', '蒙古族', '内蒙古-呼和浩特', '共青团员', '院系', False, False, '无', None, '一队'),
('苏钰媛', '女', '2025212738', '新闻与传播学院', '新硕53', '13882219310', '2412791062@qq.com', '10#102', '2003-10-29', '汉族', '四川省成都市', '共青团员', '院系', False, False, '无', None, '一队'),
('苏紫昕', '女', '2022210029', '建筑学院', '建研22', '18907726622', 'suzx22@mails.tsinghua.edu.cn', '无', '1999-08-03', '壮族', '广西省柳州市', '共青团员', '院系', False, False, '无', None, '一队'),
('孙佳鸣', '女', '2023213478', '美术学院', '美硕332', '15958872647', '15958872647@163.com', '36', '2000-12-01', '汉族', '浙江宁波', '中共党员', '院系', False, False, '二队业务', None, '一队'),
('谈皓', '男', '2024370005', '计算机系', '计研32', '13146022522', 'tanh24@mails.tsinghua.edu.cn', '28#237', '1999-03-17', '汉族', '澳门', '群众', '无', False, True, '无', None, '一队'),
('陶之艺', '女', '2023013214', '求真书院', '求真30', '13918833489', 'taozy23@mails.tsinghua.edu.cn', '紫9#507B', '2004-11-17', '汉族', '上海市', '共青团员', '院系', False, False, '后勤副队长', None, '一队'),
('庹舒婷', '女', '2024212996', '新闻与传播学院', '新硕42', '13594351385', 'tst24@mails.tsinghua.edu.cn', '36#309', '2000-10-11', '汉族', '重庆市', '共青团员', '院系', False, False, '宣传副队长', None, '一队'),
('王俊斌', '男', '2023011228', '化学工程系', '兵三', '17877308887', '2777943953@qq.com', '紫荆12#403A', '2005-06-11', '汉族', '广西-桂林', '共青团员', '院系', False, False, '无', None, '一队'),
('王天骄', '女', '2019312259', '人文学院', '文博191', '13439433970', '1090885475@qq.com', '7#223', '1998-06-14', '汉族', '河北-保定', '共青团员', '院系', False, False, '无', None, '一队'),
('王雪莹', '女', '2024011405', '经济管理学院', '经45', '13521020921', 'wang-xue24@mails.tsinghua.edu.cn', '紫5#223A', '2006-02-09', '汉族', '北京市', '共青团员', '院系', False, False, '二队队长', None, '一队'),
('王艺晓', '女', '2023213146', '新闻与传播学院', '新闻92', '13697530066', 'yixiao-w23@mails.tsinghua.edu.cn', '33#507', '2001-05-21', '汉族', '海南-屯昌', '中共党员', '院系', False, True, '无', None, '一队'),
('王子路', '男', '2025213227', '苏世民书院', '苏世民25', '13301771832', 'zilu.wang@sc.tsinghua.edu.cn', '苏世民351', '1998-04-25', '汉族', '山东省莘县', '群众', '无', False, False, '队员', None, '一队'),
('吴柔影', '女', '2022012500', '日新书院', '日新23', '18990626502', 'wury22@mails.tsinghua.edu.cn', '紫4#219B', '2002-12-18', '汉族', '四川宜宾', '共青团员', '院系', False, False, '无', None, '一队'),
('吴游', '女', '2024080137', '经济管理学院', '经48', '15026706050', 'wy24@mails.tsinghua.edu.cn', '紫23#1026A', '2006-02-21', '泰国', '泰国', '国际生', '无', False, False, '无', None, '一队'),
('肖雯莉', '女', '2021010965', '建筑学院', '建13', '13996217606', 'xiaowl21@mails.tsinghua.edu.cn', '紫荆5#331B', '2003-09-05', '汉族', '重庆市', '共青团员', '院系', True, False, '无', None, '一队'),
('徐晗艺', '女', '2023213653', '卫健学院', '23硕', '18513093637', 'hanexu@163.com', '学生公寓32号楼', '1995-02-13', '汉族', '山东-济宁', '共青团员', '院系', False, False, '无', None, '一队'),
('徐佳萌', '女', '2023312108', '外文系', '人文博232', '15254176537', 'xu_jiameng812@163.com', '7#635', '1998-08-12', '汉族', '山东-济南', '中共党员', '院系', False, False, '无', None, '一队'),
('许珑女', '女', '2023213953', '网络科学与网络空间研究院', '网研23', '18810936058', 'xln23@mails.tsinghua.edu.cn', '32', '2000-11-11', '汉族', '黑龙江省鸡西市', '预备党员', '院系', False, False, '常务副队长', None, '一队'),
('尹柔涵', '女', '2024213166', '社科学院', '社科硕41', '15776207277', 'yin-rh24@mails.tsinghua.edu.cn', '36#102', '2002-07-19', '汉族', '黑龙江-哈尔滨', '预备党员', '艺术团', False, True, '辅导员', None, '一队'),
('俞楷文', '男', '2024012275', '日新书院', '日新46', '15058110481', '2146104139@qq.com', '9#206', '2006-08-04', '汉族', '浙江省杭州市', '共青团员', '院系', False, False, '二队支书', None, '一队'),
('张浩然', '男', '2024310950', '化学工程系', '研二班', '13940575300', 'zhr24@mails.tsinghua.edu.cn', '9#208', '2002-11-05', '锡伯族', '辽宁省本溪市', '中共党员', '院系', False, False, '无', None, '一队'),
('张睿', '女', '2023312518', '医学院', '临医研三', '13699106321', 'rui-zhan23@mails.tsinghua.edu.cn', '紫荆18#301A', '1997-03-24', '汉族', '北京-海淀区', '共青团员', '院系', False, False, '无', None, '一队'),
('张诗然', '女', '2023011993', '美术学院', '艺37', '13251516391', 'zhang-sr23.mails@tsinghua.edu.cn', '紫8#209A', '2005-05-09', '汉族', '黑龙江-哈尔滨', '群众', '无', False, False, '无', None, '二队'),
('张馨月', '女', '2024012578', '未央书院', '未央-材41', '13817477339', 'xinyuezh24@mails.tsinghua.edu.cn', '紫4#403A', '2006-07-29', '汉族', '江苏省海门市', '共青团员', '院系', False, False, '内外联副队长', None, '一队'),
('张叶佳', '女', '2025212683', '新闻与传播学院', '新硕52', '18810656377', 'zhangyej21@mails.tsinghua.edu.cn', '33#101', '2002-12-09', '汉族', '山西省运城市', '中共党员', '艺术团', False, True, '无', None, '一队'),
('张宇轩', '男', '2024080086', '秀钟书院', '秀钟42', '13717760195', 'yuxuandavidzhang@outlook.com', '紫23#218', '2006-11-06', '汉族', '芬兰', '国际生', '无', False, False, '队员', None, '一队'),
('赵嘉琦', '女', '2023310044', '建筑学院', '建研35', '13716106988', 'zhao-jq23@mails.tsinghua.edu.cn', '红杉公寓#1503', '2001-04-29', '汉族', '福建省漳州市', '中共党员', '院系', False, False, '无', None, '一队'),
('赵明波', '男', '2020310325', '机械系', '机研201', '18800120591', '752862425@qq.com', '双清南1334', '1999-03-07', '汉族', '河南-焦作', '中共党员', '院系', False, False, '无', None, '一队'),
('赵芷欣', '女', '2022012188', '新雅书院', '新雅23-智2', '13810367340', 'zhaozhix22@mails.tsinghua.edu.cn', '10北#508', '2004-07-06', '汉族', '河北省吴桥县', '共青团员', '艺术团', False, True, '无', None, '一队'),
('赵梓轩', '女', '2023012272', '新雅书院分流自动化系', '新雅33自32', '18178296147', '1493380262@qq.com', '10北#513', '2005-06-10', '回族', '湖南省临澧县', '共青团员', '院系', False, False, '无', None, '一队'),
('周怡巧', '女', '2022012753', '致理书院', '致理-物22', '18221694307', 'zhouyiqi22@mails.tsinghua.edu.cn', '紫荆4#312A', '2004-03-30', '汉族', '上海-徐汇区', '共青团员', '院系', False, False, '无', None, '一队'),
('周易知', '男', '2023213807', '生物医学工程学院', '临医', '18991368382', 'zyz23@mails.tsinghua.edu.cn', '校外', '2000-05-17', '汉族', '陕西省西安市', '中共党员', '院系', False, False, '无', None, '一队'),
('朱利娅娜', '女', '2022013412', '社会科学学院', '社科2D', '18401261885', 'zlyn22@mails.tsinghua.edu.cn', '紫5#420A', '2003-11-19', '回族', '湖北省天门市', '共青团员', '院系', False, True, '无', None, '一队'),
]

# Additional participants not in the detail file (name only)
EXTRA_PARTICIPANTS = [
    '王懿峥', '王佳琪', '张尧禹', '张子约', '陈康垚', '田淇', '余卓然',
    '景亿', '庄静', '裴雨桐', '罗梓叶', '旦增西热', '柯知言', '王宇轩',
    '陈明兮', '邓文静', '乔炫嘉', '武冰洁', '高同阳', '郑煜舷', '陈思颖',
    '陈海雁', '肖艳', '邓欣晨',
]

# ─── Program definitions ──────────────────────────────────────────
PROGRAMS = {
    '芭蕾基训': {'color': '#E91E63', 'desc': '周日 9:00-11:00 | 新清舞蹈排练厅'},
    '冰凌花':   {'color': '#9C27B0', 'desc': '周日 12:00-14:15 | 新清舞蹈排练厅'},
    '香扇藏春': {'color': '#FF9800', 'desc': '周日 14:15-16:30 | 新清舞蹈排练厅'},
    '冬':       {'color': '#2196F3', 'desc': '周六 12:00-14:15 | 新清舞蹈排练厅'},
    '大河之子': {'color': '#4CAF50', 'desc': '周六 14:30-16:45 | 新清舞蹈排练厅'},
    '我们看见了鸿雁': {'color': '#F44336', 'desc': '周日 18:45-21:00 | 新清舞蹈排练厅'},
}

# Program member assignments (from Excel)
PROGRAM_MEMBERS = {
    '芭蕾基训': ['许珑女', '陶之艺', '何烨', '李婧含', '李岱宸', '王佳琪', '陈煦霖', '罗子靖', '乐宸旸', '潘奕嘉', '张子约', '龙宁睿', '王雪莹', '周怡巧', '赵芷欣', '马平川', '艾丽雅', '陈康垚', '朱利娅娜', '鲁良佑', '李延昊', '张馨月', '田淇', '谈皓', '俞楷文', '倪笑予', '张浩然', '罗梓叶', '周易知', '旦增西热', '柯知言', '王宇轩', '陈明兮', '龚晓涵', '赵嘉琦', '李仕萌', '邓文静', '刘牧杨', '乔炫嘉', '王子路', '刘可欣', '庹舒婷', '彭程', '肖艳'],
    '冰凌花': ['许珑女', '牛宇迪', '石一彤', '陈煦霖', '乐宸旸', '张子约', '赵芷欣', '朱利娅娜', '张馨月', '倪笑予', '裴雨桐', '徐佳萌', '陈明兮', '龚晓涵', '刘牧杨', '刘可欣', '李清扬', '王天骄', '王宇轩'],
    '香扇藏春': ['陶之艺', '刘宇晗', '张叶佳', '李岱宸', '陈煦霖', '张诗然', '龙宁睿', '潘星宇', '韩娅非', '贺宁怡', '裴雨桐', '邓文静', '徐晗艺', '陈海雁', '王艺晓', '庹舒婷', '吴柔影', '肖艳', '孙佳鸣', '邓欣晨'],
    '冬': ['任书漫', '骆佳', '苏钰媛', '李岱宸', '石一彤', '潘奕嘉', '赖爰恩', '张睿', '王雪莹', '周怡巧', '艾丽雅', '黄子莟', '方青帝', '庄静', '罗梓叶', '龚晓涵', '赵嘉琦', '肖雯莉', '陈思颖', '庹舒婷', '李清扬', '肖艳'],
    '大河之子': ['王懿峥', '张尧禹', '陈康垚', '鲁良佑', '李延昊', '谈皓', '俞楷文', '景亿', '谌卓凡', '周易知', '王子路', '王俊斌', '高同阳', '郑煜舷', '赵明波', '陈汜玄'],
    '我们看见了鸿雁': ['许珑女', '任书漫', '骆佳', '苏钰媛', '张叶佳', '李婧含', '乐宸旸', '龙宁睿', '赵芷欣', '张馨月', '倪笑予', '刘牧杨', '徐晗艺', '武冰洁', '傅煜涵', '刘可欣', '王懿峥', '何烨', '罗子靖', '马平川', '鲁良佑', '李延昊', '余卓然', '谈皓', '俞楷文', '谌卓凡', '张浩然', '周易知', '李仕萌', '王子路', '王俊斌', '郑煜舷', '赵明波', '陈汜玄'],
}

# Program leaders: program_name -> [member_name, ...]
LEADERS = {
    '冬': ['黄子莟', '艾丽雅'],
    '大河之子': ['谈皓', '谌卓凡'],
    '芭蕾基训': ['陈煦霖', '许珑女'],
    '冰凌花': ['赵芷欣', '朱利娅娜'],
    '香扇藏春': ['韩娅非', '王艺晓'],
    '我们看见了鸿雁': ['李延昊', '张馨月'],
}

# ─── Teachers ─────────────────────────────────────────────────────
# program_name -> teacher_name
TEACHER_MAP = {
    '冬': '金焕雯',
    '大河之子': '杨家骏',
    '芭蕾基训': '张伟',
    '冰凌花': '徐末子',
    '香扇藏春': '李佳昕',
    '我们看见了鸿雁': '李露露',
}

# ─── Venue time slots ────────────────────────────────────────────
# 新清舞蹈排练厅: (day_of_week 0=Mon, start, end)
XINQING_SLOTS = [
    (0, time(12, 0), time(19, 0)),   # 周一
    (1, time(12, 0), time(15, 0)),   # 周二
    (2, time(15, 30), time(22, 0)),  # 周三
    (3, time(12, 0), time(22, 0)),   # 周四
    (4, time(17, 30), time(22, 0)),  # 周五
    (5, time(11, 30), time(22, 0)),  # 周六
    (6, time(8, 0), time(22, 0)),    # 周日
]
# 实验剧场
SHIYAN_SLOTS = [
    (6, time(12, 0), time(22, 0)),   # 周日
]

# ─── Training schedule ───────────────────────────────────────────
# Regular weekly: (day_of_week, program_name, start_time, end_time)
WEEKLY_SCHEDULE = [
    (5, '冬',           time(12, 0),  time(14, 15)),  # 周六
    (5, '大河之子',      time(14, 30), time(16, 45)),  # 周六
    (6, '芭蕾基训',      time(9, 0),   time(11, 0)),   # 周日
    (6, '冰凌花',        time(12, 0),  time(14, 15)),  # 周日
    (6, '香扇藏春',      time(14, 15), time(16, 30)),  # 周日
    (6, '我们看见了鸿雁', time(18, 45), time(21, 0)),   # 周日
]

# Extra rehearsals on March 1 (Sunday, week 1)
MAR1_EXTRA = [
    ('冰凌花',        date(2026, 3, 1), time(12, 0),  time(13, 30)),
    ('大河之子',      date(2026, 3, 1), time(19, 0),  time(21, 0)),
    ('香扇藏春',      date(2026, 3, 1), time(13, 30), time(15, 0)),
    ('我们看见了鸿雁', date(2026, 3, 1), time(15, 0),  time(17, 30)),
]

# ─── School calendar ─────────────────────────────────────────────
# Week 0 starts Feb 16, 2026 (Monday)
WEEK0_MONDAY = date(2026, 2, 16)

# Training: Mar 7 (Sat week 2) to May 31 (Sun week 14)
TRAINING_START = date(2026, 3, 7)
TRAINING_END = date(2026, 5, 31)

# Holidays (no teacher allowed)
HOLIDAYS = [
    ('清明节', date(2026, 4, 4), date(2026, 4, 6)),
    ('校庆日', date(2026, 4, 25), date(2026, 4, 26)),
    ('劳动节', date(2026, 4, 30), date(2026, 5, 6)),
]

PERFORMANCE_DATE = date(2026, 5, 31)


def school_week(d):
    """Return school week number for a date (week 0 = Feb 16)."""
    delta = (d - WEEK0_MONDAY).days
    return delta // 7


def is_holiday(d):
    """Check if date falls within a holiday period."""
    for name, start, end in HOLIDAYS:
        if start <= d <= end:
            return name
    return None


def parse_date(s):
    """Parse 'YYYY-MM-DD' string to date."""
    if not s:
        return None
    parts = s.split('-')
    if len(parts) == 3:
        try:
            return date(int(parts[0]), int(parts[1]), int(parts[2]))
        except (ValueError, TypeError):
            pass
    return None


def main():
    app = create_app('production')

    with app.app_context():
        # Safety check
        existing = Semester.query.filter_by(name='2026春季').first()
        if existing:
            print(f'学期 "2026春季" 已存在 (id={existing.id})，跳过导入。')
            return

        # ── 1. Create semester ──
        semester = Semester(
            name='2026春季',
            semester_type=Semester.TYPE_SPRING,
            start_date=TRAINING_START,
            end_date=TRAINING_END,
        )
        db.session.add(semester)
        db.session.flush()
        Semester.query.update({'is_current': False})
        semester.is_current = True
        print(f'[1] 学期: {semester.name} (id={semester.id})')

        # ── 2. Create members ──
        member_map = {}  # name -> Member

        for (name, gender, sid, dept, cls, phone, email, dorm,
             bdate, eth, hometown, pol, party, talented, conc,
             role, jyear, level) in DETAILED_MEMBERS:
            m = Member(
                name=name, gender=gender, student_id=sid,
                department=dept, class_name=cls, phone=phone,
                email=email, dormitory=dorm,
                birth_date=parse_date(bdate),
                ethnicity=eth, hometown=hometown,
                political_status=pol, party_branch=party,
                is_talented=talented, is_concentrated_class=conc,
                team_role=role if role != '无' else None,
                join_year=jyear, team_level=level,
                status='active',
            )
            db.session.add(m)
            member_map[name] = m

        for name in EXTRA_PARTICIPANTS:
            if name not in member_map:
                m = Member(name=name, status='active')
                db.session.add(m)
                member_map[name] = m

        db.session.flush()
        print(f'[2] 成员: {len(member_map)} 人 ({len(DETAILED_MEMBERS)} 详细 + {len([n for n in EXTRA_PARTICIPANTS if n not in {d[0] for d in DETAILED_MEMBERS}])} 仅姓名)')

        # ── 3. Create user accounts for all members ──
        user_count = 0
        for name, member in member_map.items():
            user = User(
                username=name,
                display_name=name,
                role=User.ROLE_MEMBER,
                status='active',
                member_id=member.id,
            )
            user.set_password('123456')
            db.session.add(user)
            user_count += 1
        db.session.flush()
        print(f'[3] 用户账号: {user_count} 个 (密码: 123456)')

        # ── 4. Create programs + assign members ──
        program_map = {}  # name -> Program
        for pname, pinfo in PROGRAMS.items():
            prog = Program(
                name=pname,
                category=Program.CATEGORY_DANCE,
                description=pinfo['desc'],
                display_color=pinfo['color'],
                semester_id=semester.id,
                status=Program.STATUS_ACTIVE,
            )
            db.session.add(prog)
            db.session.flush()
            program_map[pname] = prog

            member_names = PROGRAM_MEMBERS.get(pname, [])
            added = 0
            for mname in member_names:
                member = member_map.get(mname)
                if not member:
                    print(f'  ! 成员 {mname} 未找到')
                    continue
                pm = ProgramMember(
                    program_id=prog.id,
                    member_id=member.id,
                    status='active',
                )
                db.session.add(pm)
                added += 1

            print(f'  {pname}: {added} 人')

        db.session.flush()
        print(f'[4] 节目: {len(program_map)} 个')

        # ── 5. Set leaders + upgrade to program_manager ──
        leader_count = 0
        for pname, leader_names in LEADERS.items():
            prog = program_map[pname]
            for lname in leader_names:
                member = member_map.get(lname)
                if not member:
                    print(f'  ! 负责人 {lname} 未找到')
                    continue

                # Set is_leader on ProgramMember
                pm = ProgramMember.query.filter_by(
                    program_id=prog.id, member_id=member.id,
                ).first()
                if pm:
                    pm.is_leader = True
                    leader_count += 1

                # Upgrade user role
                user = User.query.filter_by(member_id=member.id).first()
                if user:
                    if user.role == User.ROLE_MEMBER:
                        user.role = User.ROLE_PROGRAM_MANAGER
                    existing_up = UserProgram.query.filter_by(
                        user_id=user.id, program_id=prog.id,
                    ).first()
                    if not existing_up:
                        db.session.add(UserProgram(
                            user_id=user.id, program_id=prog.id,
                        ))

        db.session.flush()
        print(f'[5] 负责人: {leader_count} 位')

        # ── 6. Create teachers + ProgramTeacher ──
        teacher_map = {}  # name -> Teacher
        for pname, tname in TEACHER_MAP.items():
            if tname not in teacher_map:
                teacher = Teacher(name=tname, specialty='舞蹈', status='active')
                db.session.add(teacher)
                db.session.flush()
                teacher_map[tname] = teacher

            prog = program_map[pname]
            teacher = teacher_map[tname]
            db.session.add(ProgramTeacher(
                program_id=prog.id, teacher_id=teacher.id,
            ))

        db.session.flush()
        print(f'[6] 教师: {len(teacher_map)} 位')

        # ── 7. Create venues + time slots ──
        xinqing = Venue(
            name='新清舞蹈排练厅', location='新清华学堂', is_active=True,
        )
        db.session.add(xinqing)
        shiyan = Venue(
            name='实验剧场', is_active=True,
        )
        db.session.add(shiyan)
        db.session.flush()

        for day, start, end in XINQING_SLOTS:
            db.session.add(VenueTimeSlot(
                venue_id=xinqing.id, semester_id=semester.id,
                day_of_week=day, start_time=start, end_time=end,
                is_available=True,
            ))
        for day, start, end in SHIYAN_SLOTS:
            db.session.add(VenueTimeSlot(
                venue_id=shiyan.id, semester_id=semester.id,
                day_of_week=day, start_time=start, end_time=end,
                is_available=True,
            ))
        db.session.flush()
        print(f'[7] 场地: 2 个, 时段: {len(XINQING_SLOTS) + len(SHIYAN_SLOTS)} 条')

        # ── 8. Create rehearsals + venue bookings ──
        admin = User.query.filter_by(username='admin').first()
        rehearsal_count = 0

        # Generate all training Saturdays and Sundays
        d = TRAINING_START
        while d <= TRAINING_END:
            dow = d.weekday()  # 5=Sat, 6=Sun
            if dow in (5, 6):
                week_num = school_week(d)
                holiday = is_holiday(d)

                for sched_dow, pname, stime, etime in WEEKLY_SCHEDULE:
                    if sched_dow != dow:
                        continue

                    prog = program_map[pname]
                    tname = TEACHER_MAP.get(pname)
                    teacher = teacher_map.get(tname) if tname and not holiday else None

                    notes_parts = [f'第{week_num}周']
                    if holiday:
                        notes_parts.append(f'{holiday}假期, 不请老师')
                    if d == PERFORMANCE_DATE:
                        notes_parts.append('专场演出日')

                    rehearsal = Rehearsal(
                        program_id=prog.id,
                        teacher_id=teacher.id if teacher else None,
                        scheduled_date=d,
                        scheduled_start_time=stime,
                        scheduled_end_time=etime,
                        location='新清舞蹈排练厅',
                        status=Rehearsal.STATUS_SCHEDULED,
                        notes='; '.join(notes_parts),
                    )
                    db.session.add(rehearsal)
                    db.session.flush()

                    # Create venue booking
                    db.session.add(VenueBooking(
                        venue_id=xinqing.id,
                        program_id=prog.id,
                        rehearsal_id=rehearsal.id,
                        date=d,
                        start_time=stime,
                        end_time=etime,
                        status='confirmed',
                        booked_by=admin.id,
                        notes=rehearsal.notes,
                    ))
                    rehearsal_count += 1

            d += timedelta(days=1)

        # Extra rehearsals on March 1
        for pname, rdate, stime, etime in MAR1_EXTRA:
            prog = program_map[pname]
            week_num = school_week(rdate)
            rehearsal = Rehearsal(
                program_id=prog.id,
                teacher_id=None,
                scheduled_date=rdate,
                scheduled_start_time=stime,
                scheduled_end_time=etime,
                location='新清舞蹈排练厅',
                status=Rehearsal.STATUS_SCHEDULED,
                notes=f'第{week_num}周; 额外排练学动作',
            )
            db.session.add(rehearsal)
            db.session.flush()
            db.session.add(VenueBooking(
                venue_id=xinqing.id,
                program_id=prog.id,
                rehearsal_id=rehearsal.id,
                date=rdate,
                start_time=stime,
                end_time=etime,
                status='confirmed',
                booked_by=admin.id,
                notes=rehearsal.notes,
            ))
            rehearsal_count += 1

        db.session.flush()
        print(f'[8] 排练: {rehearsal_count} 场')

        # ── 9. Calendar events for holidays + performance ──
        # Get event types
        holiday_type = EventType.query.filter_by(name='其他').first()
        perf_type = EventType.query.filter_by(name='演出').first()

        for hname, hstart, hend in HOLIDAYS:
            db.session.add(CalendarEvent(
                event_type_id=holiday_type.id if holiday_type else 1,
                title=hname,
                description=f'{hname}期间不安排教师',
                start_date=hstart,
                end_date=hend,
                is_all_day=True,
                status='active',
                created_by=admin.id,
            ))

        db.session.add(CalendarEvent(
            event_type_id=perf_type.id if perf_type else 1,
            title='春季专场演出',
            description='2026春季学期专场演出',
            start_date=PERFORMANCE_DATE,
            is_all_day=True,
            status='active',
            created_by=admin.id,
        ))
        print(f'[9] 日历事件: {len(HOLIDAYS)} 假期 + 1 演出')

        # ── Commit ──
        db.session.commit()
        print(f'\n=== 导入完成 ===')
        print(f'学期: 2026春季 ({TRAINING_START} ~ {TRAINING_END})')
        print(f'成员: {len(member_map)} 人')
        print(f'节目: {len(program_map)} 个')
        print(f'教师: {len(teacher_map)} 位')
        print(f'排练: {rehearsal_count} 场')


if __name__ == '__main__':
    main()
