# llama.cpp exige SPIRV-Headers para compilar el backend Vulkan. El paquete
# oficial solo distribuye el archivo de configuración; aquí apuntamos al clon
# ligero del repositorio (android/native/spirv-headers) para no requerir el
# SDK completo de Vulkan en Windows.
set(SPIRV-Headers_FOUND TRUE)
set(SPIRV-Headers_INCLUDE_DIR "${CMAKE_CURRENT_LIST_DIR}/../spirv-headers/include")

if(EXISTS "${SPIRV-Headers_INCLUDE_DIR}/spirv/unified1/spirv.hpp")
    include_directories("${SPIRV-Headers_INCLUDE_DIR}")
else()
    message(FATAL_ERROR "Faltan las cabeceras SPIR-V en ${SPIRV-Headers_INCLUDE_DIR}. Clona https://github.com/KhronosGroup/SPIRV-Headers en android/native/spirv-headers.")
endif()
