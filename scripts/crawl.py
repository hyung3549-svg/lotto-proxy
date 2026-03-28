import urllib.request
import urllib.parse
import json
import re
import os

def fetch_page(page):
    url = "https://www.lotto.co.kr/lotto_info/list_ajax"
    data = urllib.parse.urlencode({
        "category": "AC01",
        "startPos": str((page-1)*10+1),
        "endPos": str(page*10),
        "pageSize": "10",
        "total": "1217",
        "page": str(page),
        "code_type_id": "2"
    }).encode()
    req = urllib.request.Request(url, data=data, headers={
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://www.lotto.co.kr/article/list/AC01"
    })
    try:
        return urllib.request.urlopen(req, timeout=10).read().decode("utf-8", errors="ignore")
    except:
        return None

def get_total():
    url = "https://www.lotto.co.kr/lotto_info/list_cnt_ajax"
    data = urllib.parse.urlencode({"category": "AC01", "code_type_id": "2"}).encode()
    req = urllib.request.Request(url, data=data, headers={
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://www.lotto.co.kr/article/list/AC01"
    })
    try:
        res = urllib.request.urlopen(req, timeout=10).read().decode("utf-8")
        return json.loads(res)["count"]
    except:
        return 0

def main():
    if os.path.exists("lotto.json"):
        with open("lotto.json", "r", encoding="utf-8") as f:
            existing = json.load(f)
        existing_rounds = {d["round"] for d in existing}
        latest_round = max(existing_rounds)
        print(f"기존 데이터: {len(existing)}회차 (최신: {latest_round}회)")
    else:
        existing = []
        existing_rounds = set()
        latest_round = 0

    total = get_total()
    print(f"전체 회차: {total}")

    if total <= latest_round:
        print("새로운 데이터 없음")
        return

    new_data = []
    html = fetch_page(1)
    if html:
        rounds = re.findall(r'data-options="(\d+)"', html)
        balls = re.findall(r'lottoball_92/on/(\d+)\.png', html)
        bonus = re.findall(r'lottoball_92/bonus/(\d+)\.png', html)
        dates = re.findall(r'<span>(\d{4}-\d{2}-\d{2})</span>', html)
        for i, r in enumerate(rounds):
            if int(r) in existing_rounds:
                continue
            start = i * 6
            if start+6 <= len(balls) and i < len(bonus):
                nums = sorted([int(balls[start+j]) for j in range(6)])
                new_data.append({
                    "round": int(r),
                    "date": dates[i] if i < len(dates) else "",
                    "nums": nums,
                    "bonus": int(bonus[i])
                })
                print(f"새 데이터: {r}회 {nums} 보너스 {bonus[i]}")

    if not new_data:
        print("새로운 데이터 없음")
        return

    all_data = existing + new_data
    all_data = list({d["round"]: d for d in all_data}.values())
    all_data.sort(key=lambda x: x["round"], reverse=True)

    with open("lotto.json", "w", encoding="utf-8") as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)

    print(f"완료! 총 {len(all_data)}회차 (신규 {len(new_data)}개 추가)")

if __name__ == "__main__":
    main()
