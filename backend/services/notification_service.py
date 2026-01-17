"""Notification service for sending alerts to members."""
from datetime import datetime
from typing import List
from models import CalendarEvent, Member, ProgramMember


class NotificationService:
    """通知服务"""

    @staticmethod
    def get_event_recipients(event: CalendarEvent) -> List[Member]:
        """
        获取事件通知的接收者列表

        Args:
            event: 队历事件

        Returns:
            队员列表
        """
        if not event.program_id:
            # 全团事件：通知所有active成员
            return Member.query.filter_by(status='active').all()

        # 节目事件：通知该节目的所有active成员
        program_members = ProgramMember.query.filter_by(
            program_id=event.program_id,
            status='active'
        ).all()

        return [pm.member for pm in program_members if pm.member.status == 'active']

    @staticmethod
    def format_event_message(event: CalendarEvent) -> str:
        """
        格式化事件通知消息

        Args:
            event: 队历事件

        Returns:
            通知消息文本
        """
        msg_parts = []

        # 标题和类型
        type_icon = event.event_type.icon if event.event_type else '📅'
        msg_parts.append(f"{type_icon} {event.title}")

        # 时间
        time_str = event.get_datetime_display()
        msg_parts.append(f"⏰ 时间: {time_str}")

        # 地点
        if event.location:
            msg_parts.append(f"📍 地点: {event.location}")

        # 节目
        if event.program:
            msg_parts.append(f"🎭 节目: {event.program.name}")

        # 说明
        if event.description:
            msg_parts.append(f"📝 说明: {event.description}")

        return '\n'.join(msg_parts)

    @staticmethod
    def send_event_notification(event: CalendarEvent) -> dict:
        """
        发送事件通知

        Args:
            event: 队历事件

        Returns:
            发送结果统计
        """
        if not event.notify_members:
            return {'success': False, 'error': '该事件未启用通知'}

        if event.notification_sent:
            return {'success': False, 'error': '通知已发送'}

        # 获取接收者
        recipients = NotificationService.get_event_recipients(event)

        if not recipients:
            return {'success': False, 'error': '没有找到接收者'}

        # 格式化消息
        message = NotificationService.format_event_message(event)

        # TODO: 实际的通知发送逻辑
        # 这里可以对接短信/邮件/推送通知服务
        # 示例：
        # - 短信：对接云片、阿里云等短信服务
        # - 邮件：使用 Flask-Mail 发送邮件
        # - 推送：对接极光推送、个推等服务
        # - 企业微信：对接企业微信机器人

        sent_count = 0
        failed_list = []

        for member in recipients:
            try:
                # 示例：记录到日志（实际应该发送真实通知）
                print(f"[通知] 发送给 {member.name} (ID: {member.id})")
                print(f"内容: {message}")
                print("-" * 50)

                # TODO: 实际发送逻辑
                # if member.phone:
                #     send_sms(member.phone, message)
                # if member.email:
                #     send_email(member.email, event.title, message)

                sent_count += 1
            except Exception as e:
                print(f"发送给 {member.name} 失败: {str(e)}")
                failed_list.append({
                    'member_id': member.id,
                    'member_name': member.name,
                    'error': str(e)
                })

        # 更新通知状态
        from database import db
        event.notification_sent = True
        event.notification_sent_at = datetime.utcnow()
        db.session.commit()

        return {
            'success': True,
            'total_recipients': len(recipients),
            'sent_count': sent_count,
            'failed_count': len(failed_list),
            'failed_list': failed_list,
            'message': message
        }

    @staticmethod
    def send_rehearsal_reminder(rehearsal_id: int, hours_before: int = 2) -> dict:
        """
        发送排练提醒（可用于定时任务）

        Args:
            rehearsal_id: 排练ID
            hours_before: 提前几小时提醒

        Returns:
            发送结果
        """
        from models import Rehearsal
        from datetime import datetime, timedelta

        rehearsal = Rehearsal.query.get(rehearsal_id)
        if not rehearsal:
            return {'success': False, 'error': '排练不存在'}

        # 检查排练时间
        rehearsal_datetime = datetime.combine(
            rehearsal.scheduled_date,
            rehearsal.scheduled_start_time or datetime.min.time()
        )

        now = datetime.now()
        time_diff = (rehearsal_datetime - now).total_seconds() / 3600

        # 只在指定时间范围内发送提醒
        if not (hours_before - 0.5 <= time_diff <= hours_before + 0.5):
            return {'success': False, 'error': f'不在提醒时间范围内 (当前提前 {time_diff:.1f} 小时)'}

        # 查找关联的日历事件
        if rehearsal.calendar_event:
            return NotificationService.send_event_notification(rehearsal.calendar_event)

        # 如果没有关联事件，创建临时消息发送
        from models import ProgramMember, Member

        program_members = ProgramMember.query.filter_by(
            program_id=rehearsal.program_id,
            status='active'
        ).all()

        recipients = [pm.member for pm in program_members if pm.member.status == 'active']

        message = f"""🎵 排练提醒

{rehearsal.program.name} 排练

⏰ 时间: {rehearsal.scheduled_date.strftime('%Y-%m-%d')} {rehearsal.scheduled_start_time.strftime('%H:%M') if rehearsal.scheduled_start_time else ''}
📍 地点: {rehearsal.location or '待定'}

请准时参加！"""

        sent_count = 0
        for member in recipients:
            try:
                print(f"[提醒] 发送给 {member.name}")
                print(message)
                print("-" * 50)
                sent_count += 1
            except Exception as e:
                print(f"发送失败: {str(e)}")

        return {
            'success': True,
            'total_recipients': len(recipients),
            'sent_count': sent_count,
            'message': message
        }
