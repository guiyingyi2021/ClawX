#!/usr/bin/env python3
"""
Dclaw 品牌定制脚本 - ClawX 版本
用于将 ClawX 定制为 Dclaw 品牌

用法：
    python rebrand.py apply --project-dir E:/ClawX
    python rebrand.py status --project-dir E:/ClawX
    python rebrand.py revert --project-dir E:/ClawX
    python rebrand.py manifest --project-dir E:/ClawX
"""
import os
import re
import json
import shutil
import argparse
import hashlib
from pathlib import Path

# ============================================================
# 品牌配置
# ============================================================
BRAND = {
    "name": "dclaw",
    "productName": "Dclaw",
    "appName": "Dclaw",
    "appId": "com.dclaw.app",
    "description": "Dclaw - AI Assistant powered by DeepSeek",
    "copyright": "Copyright (C) 2026 Dclaw. Built on ClawX.",
    "originalNames": ["ClawX", "clawx", "CLAWX"],
    "originalProductName": "ClawX",
}

# 图标源目录（相对于本脚本所在目录的 icons/ 子目录）
SCRIPT_DIR = Path(__file__).parent
ICON_SOURCE_DIR = SCRIPT_DIR / "icons"
BACKUP_DIR = SCRIPT_DIR / "backup"

# ============================================================
# 改动清单（Manifest）- 定义所有需要定制的内容
# ============================================================
MANIFEST = {
    "icon_files": [
        "resources/icons/icon.png",
        "resources/icons/icon.ico",
        "resources/icons/128x128.png",
        "resources/icons/16x16.png",
        "resources/icons/256x256.png",
        "resources/icons/32x32.png",
        "resources/icons/48x48.png",
        "resources/icons/512x512.png",
        "resources/icons/64x64.png",
    ],
    "text_files": [
        "package.json",
        "electron-builder.yml",
        "src/assets/logo.svg",
        "src/components/layout/Sidebar.tsx",
        "src/pages/Settings/index.tsx",
        "src/pages/Setup/index.tsx",
        "src/i18n/locales/zh/settings.json",
        "src/i18n/locales/zh/setup.json",
    ],
    "code_files": [
        "src/App.tsx",
        "src/pages/Chat/index.tsx",
        "electron/api/routes/agents.ts",
        "electron/utils/openclaw-workspace.ts",
        "electron/main/updater.ts",
        "scripts/download-bundled-uv.mjs",
    ],
}


# ============================================================
# 工具函数
# ============================================================
def green(text): return f"\033[92m{text}\033[0m"
def yellow(text): return f"\033[93m{text}\033[0m"
def red(text): return f"\033[91m{text}\033[0m"
def cyan(text): return f"\033[96m{text}\033[0m"


def file_md5(path):
    """计算文件 MD5"""
    if not os.path.exists(path):
        return None
    with open(path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()


def read_file(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def write_file(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def backup_file(src_path, backup_subdir):
    """备份文件到 backup 目录"""
    rel_path = os.path.relpath(src_path, backup_subdir.replace("\\", "/").rsplit("/", 1)[0] if "/" in backup_subdir else ".")
    if not os.path.exists(src_path):
        return None
    dst_path = os.path.join(backup_subdir, rel_path)
    os.makedirs(os.path.dirname(dst_path), exist_ok=True)
    shutil.copy2(src_path, dst_path)
    return dst_path


# ============================================================
# 品牌替换规则
# ============================================================
def get_text_replacements():
    """获取文本替换规则"""
    return [
        # 名称替换（保持大小写）
        ("ClawX", "Dclaw"),
        ("clawx", "dclaw"),
        ("CLAWX", "DCLAW"),
        # 特殊产物名
        ("ClawX Desktop", "Dclaw Desktop"),
        ("ClawX AI Assistant", "Dclaw AI Assistant"),
        ("OpenClaw Desktop", "Dclaw Desktop"),
        ("OpenClaw AI Assistant", "Dclaw AI Assistant"),
    ]


def apply_text_replacement(content):
    """应用文本替换"""
    for old, new in get_text_replacements():
        content = content.replace(old, new)
    return content


# ============================================================
# 各文件定制逻辑
# ============================================================
def patch_package_json(proj):
    """修改 package.json"""
    path = os.path.join(proj, "package.json")
    pkg = json.loads(read_file(path))

    pkg["name"] = BRAND["name"]
    pkg["productName"] = BRAND["productName"]
    pkg["description"] = BRAND["description"]

    # 修改 scripts 中的构建命令名称
    if "scripts" in pkg:
        for key, val in pkg["scripts"].items():
            pkg["scripts"][key] = val.replace("clawx", "dclaw").replace("ClawX", "Dclaw")

    write_file(path, json.dumps(pkg, indent=2, ensure_ascii=False) + "\n")
    print(f"  {green('[OK]')} package.json")


def patch_electron_builder(proj):
    """修改 electron-builder.yml"""
    path = os.path.join(proj, "electron-builder.yml")
    if not os.path.exists(path):
        print(f"  {yellow('[SKIP]')} electron-builder.yml 不存在")
        return

    content = read_file(path)
    content = apply_text_replacement(content)

    # 特别处理 appId（需要用正则匹配 yaml 中的 appId）
    content = re.sub(r'appId:\s*["\']?[^"\']+["\']?', f'appId: "{BRAND["appId"]}"', content)
    content = re.sub(r'productName:\s*["\']?[^"\']+["\']?', f'productName: "{BRAND["productName"]}"', content)

    write_file(path, content)
    print(f"  {green('[OK]')} electron-builder.yml")


def patch_icon_files(proj):
    """替换所有图标文件"""
    if not ICON_SOURCE_DIR.exists():
        print(f"  {red('[ERROR]')} 图标源目录不存在: {ICON_SOURCE_DIR}")
        return

    for icon_rel in MANIFEST["icon_files"]:
        src_path = ICON_SOURCE_DIR / os.path.basename(icon_rel)
        dst_path = os.path.join(proj, icon_rel)

        if src_path.exists():
            os.makedirs(os.path.dirname(dst_path), exist_ok=True)
            shutil.copy2(src_path, dst_path)
            print(f"  {green('[OK]')} {icon_rel}")
        else:
            # 尝试匹配大小写
            found = False
            for f in ICON_SOURCE_DIR.iterdir():
                if f.name.lower() == os.path.basename(icon_rel).lower():
                    shutil.copy2(f, dst_path)
                    print(f"  {green('[OK]')} {icon_rel} (matched: {f.name})")
                    found = True
                    break
            if not found:
                print(f"  {yellow('[WARN]')} 找不到图标: {icon_rel}")


def patch_source_files(proj):
    """替换源码中的品牌文字"""
    all_files = MANIFEST["text_files"] + MANIFEST["code_files"]
    count = 0

    for rel_path in all_files:
        path = os.path.join(proj, rel_path)
        if not os.path.exists(path):
            continue

        try:
            content = read_file(path)
            new_content = apply_text_replacement(content)
            if content != new_content:
                write_file(path, new_content)
                count += 1
                print(f"  {green('[OK]')} {rel_path}")
        except Exception as e:
            print(f"  {yellow('[SKIP]')} {rel_path}: {e}")

    return count


def patch_resources_nsis(proj):
    """修改 NSIS 安装脚本（如果有）"""
    nsis_dir = os.path.join(proj, "resources", "nsis")
    if not os.path.exists(nsis_dir):
        return

    for fname in os.listdir(nsis_dir):
        if fname.endswith(".nsi") or fname.endswith(".txt"):
            path = os.path.join(nsis_dir, fname)
            try:
                content = read_file(path)
                new_content = apply_text_replacement(content)
                if content != new_content:
                    write_file(path, new_content)
                    print(f"  {green('[OK]')} {rel_path}")
            except:
                pass


# ============================================================
# 命令实现
# ============================================================
def cmd_apply(proj, args):
    """应用品牌定制"""
    print(f"\n{cyan('='*50)}")
    print(f"{cyan('Dclaw 品牌定制 - Apply')}")
    print(f"{cyan('='*50)}")
    print(f"项目目录: {proj}\n")

    # 1. 备份
    print(f"[1/4] 备份原始文件...")
    backup_path = os.path.join(SCRIPT_DIR, "backup", "clawx_original")
    os.makedirs(backup_path, exist_ok=True)
    backed_up = 0
    for rel_path in MANIFEST["icon_files"] + MANIFEST["text_files"] + MANIFEST["code_files"]:
        src = os.path.join(proj, rel_path)
        if os.path.exists(src):
            backup_file(src, backup_path)
            backed_up += 1
    print(f"  已备份 {backed_up} 个文件到 backup/clawx_original/\n")

    # 2. 应用定制
    print("[2/4] 修改 package.json...")
    patch_package_json(proj)

    print("[3/4] 修改 electron-builder 配置...")
    patch_electron_builder(proj)

    print("[4/4] 替换图标和源码...")
    patch_icon_files(proj)
    count = patch_source_files(proj)
    patch_resources_nsis(proj)

    # 3. 保存 manifest
    manifest_path = SCRIPT_DIR / "manifest.json"
    manifest_data = {
        "version": "1.0",
        "project": "ClawX",
        "brand": BRAND["name"],
        "applied_at": str(Path(proj).resolve()),
        "files": MANIFEST,
    }
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, indent=2, ensure_ascii=False)

    print(f"\n{green('✓ 品牌定制完成！')}")
    print(f"\n下一步:")
    print(f"  1. cd {proj}")
    print(f"  2. pnpm install")
    print(f"  3. pnpm run package:win")


def cmd_revert(proj, args):
    """还原原始文件"""
    print(f"\n{cyan('='*50)}")
    print(f"{cyan('Dclaw 品牌定制 - Revert')}")
    print(f"{cyan('='*50)}\n")

    backup_path = os.path.join(SCRIPT_DIR, "backup", "clawx_original")
    if not os.path.exists(backup_path):
        print(f"{red('[ERROR]')} 未找到备份目录: {backup_path}")
        return

    restored = 0
    for rel_path in MANIFEST["icon_files"] + MANIFEST["text_files"] + MANIFEST["code_files"]:
        src = os.path.join(backup_path, rel_path)
        dst = os.path.join(proj, rel_path)
        if os.path.exists(src):
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(src, dst)
            print(f"  {green('[OK]')} {rel_path}")
            restored += 1

    # 删除 manifest
    manifest_path = SCRIPT_DIR / "manifest.json"
    if os.path.exists(manifest_path):
        os.remove(manifest_path)

    print(f"\n{green(f'✓ 已还原 {restored} 个文件')}")


def cmd_status(proj, args):
    """查看当前定制状态"""
    print(f"\n{cyan('='*50)}")
    print(f"{cyan('Dclaw 品牌定制 - Status')}")
    print(f"{cyan('='*50)}\n")

    manifest_path = SCRIPT_DIR / "manifest.json"
    if os.path.exists(manifest_path):
        data = json.loads(read_file(manifest_path))
        print(f"  品牌: {data['brand']}")
        print(f"  应用时间: {data['applied_at']}")
        print(f"  定制文件数: {len(data['files']['icon_files']) + len(data['files']['text_files']) + len(data['files']['code_files'])}")
    else:
        print(f"  {yellow('[WARN]')} 未检测到品牌定制")

    print(f"\n项目目录: {proj}")
    print(f"图标源目录: {ICON_SOURCE_DIR}")
    if ICON_SOURCE_DIR.exists():
        icons = list(ICON_SOURCE_DIR.iterdir())
        print(f"可用图标: {len(icons)} 个")
    else:
        print(f"  {red('[ERROR]')} 图标源目录不存在")


def cmd_manifest(proj, args):
    """生成改动清单"""
    print(f"\n{cyan('='*50)}")
    print(f"{cyan('Dclaw 品牌定制 - Manifest')}")
    print(f"{cyan('='*50)}\n")

    for category, files in MANIFEST.items():
        print(f"  {cyan(category)}: {len(files)} 个文件")
        for f in files:
            print(f"    - {f}")
        print()


# ============================================================
# 主入口
# ============================================================
def main():
    parser = argparse.ArgumentParser(
        description="Dclaw 品牌定制脚本 for ClawX",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python rebrand.py apply   --project-dir E:/ClawX   # 应用定制
  python rebrand.py revert  --project-dir E:/ClawX   # 还原
  python rebrand.py status  --project-dir E:/ClawX   # 查看状态
  python rebrand.py manifest --project-dir E:/ClawX   # 查看改动清单
        """
    )
    sub = parser.add_subparsers(dest="command", required=True)

    for cmd in ["apply", "revert", "status", "manifest"]:
        sub.add_parser(cmd, help=cmd).add_argument("--project-dir", required=True, help="ClawX 项目根目录")

    args = parser.parse_args()

    proj = os.path.abspath(args.project_dir)
    if not os.path.exists(os.path.join(proj, "package.json")):
        print(f"{red('[ERROR]')} 未找到 package.json: {proj}")
        return

    if args.command == "apply":
        cmd_apply(proj, args)
    elif args.command == "revert":
        cmd_revert(proj, args)
    elif args.command == "status":
        cmd_status(proj, args)
    elif args.command == "manifest":
        cmd_manifest(proj, args)


if __name__ == "__main__":
    main()
