from flask import Flask, jsonify, render_template
from random import sample
from flask_cors import CORS
import json
import os

app = Flask(__name__, 
    template_folder='app/templates')  # 明确指定模板目录
CORS(app)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/random-meals')
def get_random_meals():
    try:
        json_path = '/root/myapp/app/static/meals.json'
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
        
        # 返回数据时确保格式正确
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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True) 