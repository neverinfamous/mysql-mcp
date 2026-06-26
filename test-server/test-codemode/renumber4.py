import re

with open('coordinator-workflow.md', 'r') as f:
    content = f.read()

start_idx = content.find('## Test Sequence Queue')
end_idx = content.find('## Telemetry Collection')

if start_idx != -1 and end_idx != -1:
    section = content[start_idx:end_idx]
    
    filenames = re.findall(r'test-codemode-[a-z0-9-]+(?=\.md)', section)
    
    new_section = "## Test Sequence Queue (Dependency DAG)\n\n"
    new_section += "1. 	est-codemode-core-read.md (**MUST PASS FIRST**)\n"
    
    counter = 2
    for name in filenames:
        full_name = name + ".md"
        if full_name == 'test-codemode-core-read.md':
            continue
        new_section += f"{counter}. {full_name}\n"
        counter += 1
        
    new_section += "\n"
    
    new_content = content[:start_idx] + new_section + content[end_idx:]
    with open('coordinator-workflow.md', 'w') as f:
        f.write(new_content)
