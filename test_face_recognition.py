#!/usr/bin/env python3
"""
Test script for face recognition functionality.
Uses real photos from ./assets directory.
"""
import requests
import json
from datetime import datetime, timedelta

# Disable proxy for localhost
import os
os.environ['NO_PROXY'] = '*'

BASE_URL = 'http://localhost:5000/api'

class FaceRecognitionTester:
    def __init__(self):
        self.access_token = None
        self.semester_id = None
        self.program_id = None
        self.member_ids = []
        self.rehearsal_id = None

    def login(self):
        """Login as admin."""
        print("🔐 登录中...")
        response = requests.post(
            f'{BASE_URL}/auth/login',
            json={'username': 'admin', 'password': 'admin123'}
        )
        if response.status_code == 200:
            data = response.json()
            self.access_token = data['access_token']
            print(f"✅ 登录成功! 用户: {data['user']['display_name']}")
            return True
        else:
            print(f"❌ 登录失败: {response.text}")
            return False

    def headers(self):
        """Get auth headers."""
        return {'Authorization': f'Bearer {self.access_token}'}

    def create_semester(self):
        """Create a test semester."""
        print("\n📅 创建测试学期...")
        today = datetime.now()
        data = {
            'name': f'测试学期 {today.strftime("%Y-%m-%d %H:%M")}',
            'start_date': today.strftime('%Y-%m-%d'),
            'end_date': (today + timedelta(days=180)).strftime('%Y-%m-%d'),
            'is_active': True
        }
        response = requests.post(
            f'{BASE_URL}/admin/semesters',
            json=data,
            headers=self.headers()
        )
        if response.status_code == 201:
            semester = response.json()['semester']
            self.semester_id = semester['id']
            print(f"✅ 学期创建成功! ID: {self.semester_id}, 名称: {semester['name']}")
            return True
        else:
            print(f"❌ 学期创建失败: {response.text}")
            return False

    def create_program(self):
        """Create a test program."""
        print("\n🎭 创建测试节目...")
        data = {
            'name': '人脸识别测试节目',
            'description': '用于测试人脸识别功能的节目',
            'semester_id': self.semester_id,
            'status': 'active'
        }
        response = requests.post(
            f'{BASE_URL}/admin/programs',
            json=data,
            headers=self.headers()
        )
        if response.status_code == 201:
            program = response.json()['program']
            self.program_id = program['id']
            print(f"✅ 节目创建成功! ID: {self.program_id}, 名称: {program['name']}")
            return True
        else:
            print(f"❌ 节目创建失败: {response.text}")
            return False

    def create_members(self):
        """Create test members."""
        print("\n👥 创建测试成员...")
        test_members = [
            {'name': '张三', 'student_id': '2024001', 'gender': 'male'},
            {'name': '李四', 'student_id': '2024002', 'gender': 'female'},
            {'name': '王五', 'student_id': '2024003', 'gender': 'male'},
            {'name': '赵六', 'student_id': '2024004', 'gender': 'female'},
            {'name': '钱七', 'student_id': '2024005', 'gender': 'male'},
        ]

        for member_data in test_members:
            response = requests.post(
                f'{BASE_URL}/admin/members',
                json=member_data,
                headers=self.headers()
            )
            if response.status_code == 201:
                member = response.json()['member']
                self.member_ids.append(member['id'])
                print(f"  ✅ 成员创建成功: {member['name']} (ID: {member['id']})")
            else:
                print(f"  ❌ 成员创建失败: {member_data['name']} - {response.text}")

        return len(self.member_ids) > 0

    def add_members_to_program(self):
        """Add members to program."""
        print("\n🎯 将成员加入节目...")
        # Use batch endpoint
        data = {
            'member_ids': self.member_ids,
            'role': 'performer'
        }
        response = requests.post(
            f'{BASE_URL}/admin/programs/{self.program_id}/members/batch',
            json=data,
            headers=self.headers()
        )
        if response.status_code == 200:
            print(f"  ✅ 批量添加 {len(self.member_ids)} 个成员成功")
            return True
        else:
            print(f"  ❌ 批量添加失败: {response.text}")
            return False

    def create_rehearsal(self):
        """Create a test rehearsal."""
        print("\n🎪 创建测试排练...")
        today = datetime.now()
        data = {
            'program_id': self.program_id,
            'scheduled_date': today.strftime('%Y-%m-%d'),
            'start_time': '14:00',
            'end_time': '16:00',
            'location': '排练厅A',
            'notes': '人脸识别测试排练'
        }
        response = requests.post(
            f'{BASE_URL}/admin/rehearsals',
            json=data,
            headers=self.headers()
        )
        if response.status_code == 201:
            rehearsal = response.json()['rehearsal']
            self.rehearsal_id = rehearsal['id']
            print(f"✅ 排练创建成功! ID: {self.rehearsal_id}")
            return True
        else:
            print(f"❌ 排练创建失败: {response.text}")
            return False

    def test_face_recognition(self):
        """Test face recognition with real photos."""
        print("\n📸 测试人脸识别功能...")

        photos = [
            './assets/微信图片_20251207191249_710_1077.jpg',
            './assets/微信图片_20251214180343_229_1090.jpg',
            './assets/微信图片_20251215010802_782_1077.jpg'
        ]

        photo_types = ['check_in', 'check_out', 'check_in']

        for idx, photo_path in enumerate(photos):
            print(f"\n  📷 处理照片 {idx + 1}: {photo_path.split('/')[-1]}")
            photo_type = photo_types[idx % 2]

            try:
                with open(photo_path, 'rb') as photo_file:
                    files = {'photo': photo_file}
                    data = {
                        'rehearsal_id': self.rehearsal_id,
                        'photo_type': photo_type,
                        'program_id': self.program_id
                    }

                    response = requests.post(
                        f'{BASE_URL}/face/recognize',
                        files=files,
                        data=data,
                        headers=self.headers()
                    )

                    if response.status_code == 200:
                        result = response.json()
                        print(f"  ✅ 识别成功!")
                        print(f"     识别类型: {photo_type}")
                        print(f"     总人脸数: {result.get('total_faces', 0)}")
                        print(f"     匹配人脸数: {result.get('matched_faces', 0)}")
                        print(f"     未匹配人脸数: {result.get('unmatched_faces', 0)}")

                        if 'detections' in result:
                            print(f"     检测详情:")
                            for detection in result['detections'][:5]:  # 只显示前5个
                                member_name = detection.get('member_name', '未识别')
                                confidence = detection.get('confidence', 0)
                                print(f"       - {member_name} (置信度: {confidence:.2f})")
                    else:
                        print(f"  ❌ 识别失败: {response.status_code}")
                        print(f"     错误信息: {response.text}")

            except FileNotFoundError:
                print(f"  ❌ 照片文件不存在: {photo_path}")
            except Exception as e:
                print(f"  ❌ 处理照片时出错: {str(e)}")

        return True

    def run_all_tests(self):
        """Run all tests."""
        print("=" * 60)
        print("🚀 开始测试人脸识别功能")
        print("=" * 60)

        if not self.login():
            return False

        if not self.create_semester():
            return False

        if not self.create_program():
            return False

        if not self.create_members():
            return False

        if not self.add_members_to_program():
            return False

        if not self.create_rehearsal():
            return False

        if not self.test_face_recognition():
            return False

        print("\n" + "=" * 60)
        print("✅ 所有测试完成!")
        print("=" * 60)
        print(f"\n📊 测试数据摘要:")
        print(f"   学期 ID: {self.semester_id}")
        print(f"   节目 ID: {self.program_id}")
        print(f"   排练 ID: {self.rehearsal_id}")
        print(f"   成员数量: {len(self.member_ids)}")
        print(f"\n🌐 前端访问地址: http://localhost:3000")
        print(f"   使用 admin/admin123 登录查看结果\n")

        return True


if __name__ == '__main__':
    tester = FaceRecognitionTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)
