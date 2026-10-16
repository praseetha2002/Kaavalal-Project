from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    full_name = Column(String(100), nullable=False)

    email = Column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )

    hashed_password = Column(String(255), nullable=False)

    role = Column(String(30), nullable=False, default="citizen")

    district = Column(String(100), nullable=True)

    nearest_lac = Column(String(100), nullable=True)

    status = Column(String(20), nullable=False, default="active")

    # Organization details for rescuer accounts
    organization_id = Column(
        Integer,
        ForeignKey("organizations.id"),
        nullable=True,
    )

    rescuer_id = Column(String(100), nullable=True)

    # Relationship between users and organizations
    organization = relationship("Organization", backref="users")