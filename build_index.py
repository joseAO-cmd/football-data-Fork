import os
import json
import glob

def prettify_slug(slug):
    if not slug:
        return ""
    # Map some common abbreviations
    special_cases = {
        "afc": "AFC",
        "fc": "FC",
        "as": "AS",
        "rc": "RC",
        "sc": "SC",
        "us": "US",
        "psv": "PSV",
        "az": "AZ",
        "sparta": "Sparta",
        "utrecht": "Utrecht",
    }
    words = slug.replace("-", " ").split()
    prettified_words = []
    for w in words:
        wl = w.lower()
        if wl in special_cases:
            prettified_words.append(special_cases[wl])
        else:
            prettified_words.append(w.capitalize())
    return " ".join(prettified_words)

def main():
    data_dir = os.path.join(os.path.dirname(__file__), "data", "goals_time2")
    
    if not os.path.exists(data_dir):
        print(f"Error: Data directory not found at {data_dir}")
        return

    json_files = glob.glob(os.path.join(data_dir, "*.json"))
    print(f"Processing {len(json_files)} league files...")

    matches = []
    leagues = set()
    teams = set()

    for f in json_files:
        filename = os.path.basename(f)
        try:
            with open(f, 'r', encoding='utf-8') as file:
                data = json.load(file)
                for idx, match in enumerate(data):
                    league = match.get("league", "")
                    home = match.get("home", "")
                    away = match.get("away", "")
                    gh = match.get("GH")
                    ga = match.get("GA")
                    date = match.get("date", "")
                    
                    try:
                        gh = int(gh) if gh is not None else 0
                        ga = int(ga) if ga is not None else 0
                    except ValueError:
                        gh, ga = 0, 0
                    
                    matches.append({
                        "l": league,
                        "h": home,
                        "a": away,
                        "gh": gh,
                        "ga": ga,
                        "d": date,
                        "f": filename,
                        "i": idx
                    })
                    
                    if league:
                        leagues.add(league)
                    if home:
                        teams.add(home)
                    if away:
                        teams.add(away)
        except Exception as e:
            print(f"Error parsing {filename}: {e}")

    # Sort matching criteria
    sorted_leagues = sorted(list(leagues))
    sorted_teams = sorted(list(teams))

    # Pre-map display names for teams & leagues to avoid client-side calculation overhead
    team_display = {t: prettify_slug(t) for t in sorted_teams}
    league_display = {l: prettify_slug(l) for l in sorted_leagues}

    metadata = {
        "leagues": sorted_leagues,
        "teams": sorted_teams,
        "team_display": team_display,
        "league_display": league_display
    }

    output_dir = os.path.join(os.path.dirname(__file__), "web_data")
    os.makedirs(output_dir, exist_ok=True)

    with open(os.path.join(output_dir, "metadata.json"), "w", encoding="utf-8") as out:
        json.dump(metadata, out, separators=(',', ':'))

    with open(os.path.join(output_dir, "matches_index.json"), "w", encoding="utf-8") as out:
        json.dump(matches, out, separators=(',', ':'))

    print(f"Completed build! Saved {len(matches)} matches, {len(sorted_leagues)} competitions, and {len(sorted_teams)} teams.")

if __name__ == "__main__":
    main()
