import re

with open('coordinator-workflow.md', 'r') as f:
    lines = f.readlines()

new_lines = []
counter = 1
in_queue = False

for line in lines:
    if line.startswith('1. 	est-codemode-core-read.md'):
        in_queue = True
        new_lines.append('1. 	est-codemode-core-read.md (**MUST PASS FIRST**)\n')
        counter += 1
        continue
    
    if in_queue:
        match = re.match(r'^\d+[a-z]?\. ([^]+)', line)
        if match:
            filename = match.group(1)
            if 'test-codemode-core-read' in filename:
                continue
            new_lines.append(f'{counter}. {filename}\n')
            counter += 1
        else:
            if line.startswith('## '):
                in_queue = False
                new_lines.append(line)
            else:
                new_lines.append(line)
    else:
        new_lines.append(line)

with open('coordinator-workflow.md', 'w') as f:
    f.writelines(new_lines)
