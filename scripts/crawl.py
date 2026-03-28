import urllib.request
import urllib.parse
import json
import re
import os
import time

def fetch_page(page):
    url = "https://www.lotto.co.kr/lotto_info/list_ajax"
    data = urllib.parse.urlencode({
        "category": "AC01",
        "startPos": str((page-1)*10+1),
        "endPos": str(page*10),
        "pageSize": "10",
        "total": "9999",
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

def parse_latest(html):
    rounds = re.findall(r'data-options="(\d+)"', html)
    balls = re.findall(r'lottoball_92/on/(\d+)\.png', html)
    bonus = re.findall(r'lottoball_92/bonus/(\d+)\.png', html)
    dates = re.findall(r'<span>(\d{4}-\d{2}-\d{2})</span>', html)
    results = []
    for i, r in enumerate(rounds):
        start = i * 6
        if start+6 <= len(balls) and i < len(bonus):
            nums = sorted([int(balls[start+j]) for j in range(6)])
            results.append({
                "round": int(r),
                "date": dates[i] if i < len(dates) else "",
                "nums": nums,
                "bonus": int(bonus[i])
            })
    return results

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

    # 최대 30분간 1분마다 재시도
    max_attempts = 30
    for attempt in range(1, max_attempts+1):
        print(f"시도 {attempt}/{max_attempts}...")
        html = fetch_page(1)
        if html:
            rows = parse_latest(html)
            new_data = [r for r in rows if r["round"] not in existing_rounds]
            if new_data:
                print(f"새 데이터 발견! {[r['round'] for r in new_data]}회차")
                all_data = existing + new_data
                all_data = list({d["round"]: d for d in all_data}.values())
                all_data.sort(key=lambda x: x["round"], reverse=True)
                with open("lotto.json", "w", encoding="utf-8") as f:
                    json.dump(all_data, f, ensure_ascii=False, indent=2)
                print(f"완료! 총 {len(all_data)}회차 저장!")
                return
            else:
                print(f"아직 새 데이터 없음 (현재 최신: {rows[0]['round'] if rows else '?'}회)")
        else:
            print("페이지 로드 실패")

        if attempt < max_attempts:
            print("1분 후 재시도...")
            time.sleep(60)

    print("30분 내 새 데이터 없음. 종료.")

if __name__ == "__main__":
    main()
