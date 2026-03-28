'use client'

import { Avatar } from "@heroui/avatar"
import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/dropdown"

export const User = () => {
    return (
        <Dropdown placement="bottom-start">
        <DropdownTrigger>
            <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026024d" size="md" />
        </DropdownTrigger>
        <DropdownMenu aria-label="User Actions" variant="flat">
          <DropdownItem key="logout" color="danger" className=" text-red-600">
            Log Out
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    )
}