from flask import Blueprint, render_template, jsonify, request
from random import randint, sample
from datetime import datetime, timedelta
from flask_mail import Message
from .models import db, User, VerificationCode
from . import mail
import hashlib
import json
import random
import os

main = Blueprint('main', __name__, template_folder='templates')

@main.route('/')
def home():
    return render_template('index.html')

@main.route('/random')
def get_random_number():
    number = randint(0, 10000)
    return jsonify({'number': number})

@main.route('/send-code', methods=['POST'])
def send_verification_code():
    email = request.json.get('email')
    if not email:
        return jsonify({'error': '请提供邮箱地址'}), 400
        
    # 生成6位验证码
    code = ''.join([str(randint(0, 9)) for _ in range(6)])
    
    # 保存验证码
    expires_at = datetime.utcnow() + timedelta(minutes=5)
    verification = VerificationCode(
        email=email,
        code=code,
        expires_at=expires_at
    )
    db.session.add(verification)
    db.session.commit()
    
    # 发送邮件
    msg = Message('验证码',
                  sender=app.config['MAIL_USERNAME'],
                  recipients=[email])
    msg.body = f'您的验证码是：{code}，5分钟内有效。'
    mail.send(msg)
    
    return jsonify({'message': '验证码已发送'})

@main.route('/register', methods=['POST'])
def register():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    code = data.get('code')
    
    # 验证验证码
    verification = VerificationCode.query.filter_by(
        email=email,
        code=code,
        expires_at > datetime.utcnow()
    ).first()
    
    if not verification:
        return jsonify({'error': '验证码无效或已过期'}), 400
        
    # 创建用户
    hashed_password = hashlib.sha256(password.encode()).hexdigest()
    user = User(email=email, password=hashed_password)
    db.session.add(user)
    db.session.commit()
    
    return jsonify({'message': '注册成功'})

@main.route('/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    hashed_password = hashlib.sha256(password.encode()).hexdigest()
    user = User.query.filter_by(email=email, password=hashed_password).first()
    
    if not user:
        return jsonify({'error': '邮箱或密码错误'}), 401
        
    return jsonify({'message': '登录成功'})

@main.route('/random-meals')
def get_random_meals():
    try:
        json_path = os.path.join(os.path.dirname(__file__), 'static', 'meals.json')
        print(f"尝试读取文件: {json_path}")
        
        if not os.path.exists(json_path):
            print(f"文件不存在: {json_path}")
            return jsonify({'error': '菜单文件不存在'}), 500
            
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        # 筛选适合各个餐段的菜品
        breakfast_dishes = [dish for dish in data['dishes'] if dish['suitable_for']['breakfast']]
        lunch_dishes = [dish for dish in data['dishes'] if dish['suitable_for']['lunch']]
        
        print(f"早餐可选菜品数量: {len(breakfast_dishes)}")
        print(f"午餐可选菜品数量: {len(lunch_dishes)}")
        
        def select_balanced_meal(dishes):
            starches = [d for d in dishes if d['contains']['starch']]
            proteins = [d for d in dishes if d['contains']['protein']]
            vegetables = [d for d in dishes if d['contains']['vegetable']]
            
            meal = []
            if starches:
                meal.append(sample(starches, 1)[0])
            if proteins:
                meal.append(sample(proteins, 1)[0])
            if vegetables:
                meal.append(sample(vegetables, 1)[0])
            return meal
        
        breakfast = select_balanced_meal(breakfast_dishes)
        lunch = select_balanced_meal(lunch_dishes)
        
        print(f"选择的早餐菜品: {[dish['name'] for dish in breakfast]}")
        print(f"选择的午餐菜品: {[dish['name'] for dish in lunch]}")
        
        random_meals = {
            'breakfast': breakfast,
            'lunch': lunch
        }
        
        # 添加返回数据的调试信息
        print("返回的数据结构:", json.dumps(random_meals, ensure_ascii=False, indent=2))
        
        return jsonify(random_meals)
    except Exception as e:
        print(f"发生错误: {str(e)}")
        return jsonify({'error': str(e)}), 500 