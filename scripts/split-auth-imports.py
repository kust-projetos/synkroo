"""Split mixed imports: separate createClient from auth helpers."""
import re, os

for root, dirs, files in os.walk('src/app/api'):
    for fname in files:
        if not fname.endswith('.ts'):
            continue
        path = os.path.join(root, fname)
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()

        if 'auth/session' in content:
            continue

        # Match import lines from @/lib/supabase/server
        pattern = r"""import \{([^}]+)\} from ['"]@/lib/supabase/server['"]"""
        match = re.search(pattern, content)
        if not match:
            continue

        imports = match.group(1)
        has_client = 'createClient' in imports
        auth_helpers = [
            h.strip() for h in re.split(r',', imports)
            if h.strip() and 'createClient' not in h.strip()
            and any(kw in h for kw in ['validateApiAuth', 'hasRequiredRole', 'requireRole', 'validateClinicAccess'])
        ]

        if not (has_client and auth_helpers):
            continue

        old_line = match.group(0)
        new_client_line = "import { createClient } from '@/lib/supabase/server'"
        new_auth_line = f"import {{ {', '.join(auth_helpers)} }} from '@/lib/auth/session'"
        replacement = f'{new_client_line}\n{new_auth_line}'

        content = content.replace(old_line, replacement)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'SPLIT: {path}')
