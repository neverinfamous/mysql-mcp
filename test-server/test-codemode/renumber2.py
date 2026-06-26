with open('coordinator-workflow.md', 'r') as f:
    lines = f.readlines()

new_lines = []
counter = 1
in_queue = False
for line in lines:
    if line.startswith('1. 	est-codemode-core-read.md'):
        in_queue = True
        new_lines.append('1. 	est-codemode-core-read.md (**MUST PASS FIRST**)\n')
        counter = 2
        continue
    
    if in_queue:
        if line.startswith('## '):
            in_queue = False
            new_lines.append(line)
        else:
            if '	est-codemode-' in line:
                import re
                m = re.search(r'(test-codemode-[^]+)', line)
                if m:
                    new_lines.append(f'{counter}. {m.group(1)}\n')
                    counter += 1
            else:
                new_lines.append(line)
    else:
        new_lines.append(line)

with open('coordinator-workflow.md', 'w') as f:
    f.writelines(new_lines)
