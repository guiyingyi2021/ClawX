"""
Dclaw 品牌替换脚本
用法：在 Fork 下来的 Qclaw 项目根目录执行：
  python rebrand.py --project-dir /path/to/your/Qclaw-fork
"""
import os, json, re, shutil, argparse

BRAND = {
    "name":        "dclaw",
    "productName": "Dclaw",
    "description": "Dclaw - Your personal AI assistant powered by DeepSeek",
    "appId":       "com.dclaw.app",
    "copyright":   "Copyright (C) 2026 Dclaw. Built on Qclaw (Apache-2.0).",
    "old_names":   ["Qclaw", "qclaw", "QCLAW"],
}

ICON_DIR = r"c:\Users\40832\WorkBuddy\20260429101446\dclaw-brand\icons"

def replace_in_file(path, replacements):
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        changed = False
        for old, new in replacements:
            if old in content:
                content = content.replace(old, new)
                changed = True
        if changed:
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"  [OK] {path}")
        return changed
    except Exception as e:
        print(f"  [SKIP] {path}: {e}")
        return False

def patch_package_json(proj):
    path = os.path.join(proj, "package.json")
    with open(path, "r", encoding="utf-8") as f:
        pkg = json.load(f)
    pkg["name"]        = BRAND["name"]
    pkg["productName"] = BRAND["productName"]
    pkg["description"] = BRAND["description"]
    with open(path, "w", encoding="utf-8") as f:
        json.dump(pkg, f, indent=2, ensure_ascii=False)
    print(f"  [OK] package.json -> name={BRAND['name']}, productName={BRAND['productName']}")

def patch_electron_builder(proj):
    for fname in ["electron-builder.json", "electron-builder.yml", "electron-builder.yaml"]:
        path = os.path.join(proj, fname)
        if not os.path.exists(path):
            continue
        if fname.endswith(".json"):
            with open(path, "r", encoding="utf-8") as f:
                cfg = json.load(f)
            cfg["appId"]     = BRAND["appId"]
            cfg["productName"] = BRAND["productName"]
            cfg["copyright"] = BRAND["copyright"]
            with open(path, "w", encoding="utf-8") as f:
                json.dump(cfg, f, indent=2, ensure_ascii=False)
        else:
            replace_in_file(path, [
                ("Qclaw", BRAND["productName"]),
                ("qclaw", BRAND["name"]),
            ])
        print(f"  [OK] {fname}")

def copy_icons(proj):
    build_dir = os.path.join(proj, "build")
    os.makedirs(build_dir, exist_ok=True)
    for fname in ["icon.png", "icon.ico"]:
        src = os.path.join(ICON_DIR, fname)
        dst = os.path.join(build_dir, fname)
        if os.path.exists(src):
            shutil.copy2(src, dst)
            print(f"  [OK] {fname} -> build/")
    # src/assets logo
    assets_dir = os.path.join(proj, "src", "assets")
    if os.path.exists(assets_dir):
        for fname in os.listdir(assets_dir):
            if "logo" in fname.lower() or "icon" in fname.lower():
                ext = os.path.splitext(fname)[1]
                if ext in [".png", ".svg", ".ico"]:
                    sz_map = {".png": "logo-256.png", ".ico": "icon.ico"}
                    src_name = sz_map.get(ext, "icon.png")
                    src = os.path.join(ICON_DIR, src_name)
                    dst = os.path.join(assets_dir, fname)
                    if os.path.exists(src):
                        shutil.copy2(src, dst)
                        print(f"  [OK] {fname} -> src/assets/")

def patch_source_strings(proj):
    replacements = [
        ("Qclaw", "Dclaw"),
        ("qclaw", "dclaw"),
        ("秋芝2046", "Dclaw Team"),
        ("OpenClaw Manager", "Dclaw AI Assistant"),
    ]
    exts = {".ts", ".tsx", ".js", ".jsx", ".json", ".html", ".md"}
    count = 0
    for root, dirs, files in os.walk(proj):
        dirs[:] = [d for d in dirs if d not in ["node_modules", ".git", "dist", "out"]]
        for fname in files:
            if os.path.splitext(fname)[1] in exts:
                path = os.path.join(root, fname)
                if replace_in_file(path, replacements):
                    count += 1
    print(f"  [OK] 共修改 {count} 个源文件")

def patch_deepseek_default(proj):
    """在默认配置文件里预填 DeepSeek 为首选模型"""
    deepseek_config = {
        "provider": "deepseek",
        "model": "deepseek-chat",
        "apiBase": "https://api.deepseek.com/v1",
        "apiKeyPlaceholder": "sk-xxxxxxxxxxxxxxxx"
    }
    config_dir = os.path.join(proj, "src", "lib")
    for root, dirs, files in os.walk(config_dir if os.path.exists(config_dir) else proj):
        dirs[:] = [d for d in dirs if d not in ["node_modules", ".git", "dist"]]
        for fname in files:
            if "provider" in fname.lower() or "model" in fname.lower() or "default" in fname.lower():
                if fname.endswith((".ts", ".tsx", ".js")):
                    path = os.path.join(root, fname)
                    replace_in_file(path, [
                        ('"openai"', '"deepseek"'),
                        ("'openai'", "'deepseek'"),
                        ('"gpt-4"', '"deepseek-chat"'),
                        ('"gpt-4o"', '"deepseek-chat"'),
                        ("https://api.openai.com/v1", "https://api.deepseek.com/v1"),
                    ])
    # 输出默认配置文件供参考
    out = os.path.join(proj, "dclaw-default-config.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(deepseek_config, f, indent=2)
    print(f"  [OK] DeepSeek 默认配置 -> dclaw-default-config.json")

def main():
    parser = argparse.ArgumentParser(description="Dclaw 品牌替换脚本")
    parser.add_argument("--project-dir", required=True, help="Qclaw Fork 项目根目录")
    args = parser.parse_args()
    proj = os.path.abspath(args.project_dir)

    if not os.path.exists(os.path.join(proj, "package.json")):
        print(f"[ERROR] 未找到 package.json，请确认项目目录: {proj}")
        return

    print(f"\n=== Dclaw 品牌替换 ===")
    print(f"项目目录: {proj}\n")

    print("[1] 更新 package.json ...")
    patch_package_json(proj)

    print("[2] 更新 electron-builder 配置 ...")
    patch_electron_builder(proj)

    print("[3] 替换图标文件 ...")
    copy_icons(proj)

    print("[4] 替换源码中的品牌字符串 ...")
    patch_source_strings(proj)

    print("[5] 设置 DeepSeek 默认模型 ...")
    patch_deepseek_default(proj)

    print("\n=== 完成！下一步 ===")
    print("  1. cd", proj)
    print("  2. npm install")
    print("  3. npm run build -- --win   # Windows 安装包")
    print("  4. npm run build -- --mac   # macOS 安装包（需在 Mac 上执行）")
    print("\n  [注意] macOS icon.icns 需另行转换，工具: https://cloudconvert.com/png-to-icns")
    print("  [注意] About 页请手动检查是否保留了 Qclaw 原版权声明（Apache-2.0 要求）")

if __name__ == "__main__":
    main()
