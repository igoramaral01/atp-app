#!/bin/sh
# Monta public/index.html a partir de head.html + body.html
cd "$(dirname "$0")/public" && { cat head.html; cat body.html; printf '\n</body>\n</html>\n'; } > index.html
